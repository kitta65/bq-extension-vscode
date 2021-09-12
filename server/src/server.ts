import * as LSP from "vscode-languageserver/node";
import { BigQuery } from "@google-cloud/bigquery";
import { TextDocument } from "vscode-languageserver-textdocument";
import { tokenize, parse, UnknownNode, Token } from "@dr666m1/bq2cst";
import * as prettier from "prettier";
import * as util from "./util";
import { CacheDB } from "./database";

type Configuration = {
  trace: {
    server: "off" | "messages" | "verbose";
  };
  formatting: Record<string, boolean>;
};

export class BQLanguageServer {
  public static async initialize(
    connection: LSP.Connection,
    db: CacheDB,
    params: LSP.InitializeParams
  ): Promise<BQLanguageServer> {
    return new BQLanguageServer(connection, db, params);
  }
  private bqClient = new BigQuery();
  public capabilities: LSP.InitializeResult = {
    capabilities: {
      textDocumentSync: LSP.TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      documentFormattingProvider: true,
      completionProvider: {
        triggerCharacters: [".", "`"],
      },
    },
  };
  private documents: LSP.TextDocuments<TextDocument> = new LSP.TextDocuments(
    TextDocument
  );
  private hasConfigurationCapability: boolean;
  private uriToCst: Record<string, UnknownNode[]> = {};
  private uriToText: Record<string, string> = {};
  private uriToTokens: Record<string, Token[]> = {};
  private constructor(
    private connection: LSP.Connection,
    private db: CacheDB,
    params: LSP.InitializeParams
  ) {
    const capabilities = params.capabilities;
    this.hasConfigurationCapability = !!(
      capabilities.workspace && capabilities.workspace.configuration
    );
  }
  private async dryRun(uri: LSP.URI): Promise<void> {
    let diagnostic: LSP.Diagnostic;
    try {
      let msg;
      const [_, apiResponse] = await this.bqClient.createQueryJob({
        query: this.uriToText[uri],
        dryRun: true,
      });
      if (
        apiResponse.statistics &&
        apiResponse.statistics.totalBytesProcessed
      ) {
        msg = util.formatBytes(
          Number(apiResponse.statistics.totalBytesProcessed)
        );
      } else {
        msg = "???B";
      }
      this.connection.sendDiagnostics({
        uri: uri,
        diagnostics: [],
      }); // clear old diagnostics
      this.connection.sendNotification("bq/totalBytesProcessed", {
        totalBytesProcessed: msg,
      });
    } catch (e: any) {
      const msg = e.message;
      const matchResult = msg.match(/\[([0-9]+):([0-9]+)\]/);
      if (matchResult) {
        // in the case of message like below
        // Syntax error: Unexpected end of script at [1:7]
        diagnostic = {
          severity: LSP.DiagnosticSeverity.Error,
          range: util.getTokenRangeByRowColumn(
            this.getDocInfo(uri),
            Number(matchResult[1]),
            Number(matchResult[2])
          ),
          message: msg,
        };
      } else {
        // in the case of message like below
        // Table name "abc" missing dataset while no default dataset is set in the request
        const splittedText = this.uriToText[uri].split("\n");
        diagnostic = {
          severity: LSP.DiagnosticSeverity.Error,
          range: {
            start: { line: 0, character: 0 },
            end: {
              line: splittedText.length - 1,
              character: splittedText[splittedText.length - 1].length,
            },
          },
          message: msg,
        };
      }
      this.connection.sendDiagnostics({
        uri: uri,
        diagnostics: [diagnostic],
      });
      this.connection.sendNotification("bq/totalBytesProcessed", {
        totalBytesProcessed: "ERROR",
      });
    }
  }

  private async getConfiguration(): Promise<Configuration> {
    if (!this.hasConfigurationCapability) {
      return {
        trace: { server: "messages" },
        formatting: {},
      };
    }
    return await this.connection.workspace.getConfiguration({
      section: "bqExtensionVSCode",
    });
  }

  private getDocInfo(uri: string) {
    return {
      text: this.uriToText[uri],
      tokens: this.uriToTokens[uri],
      cst: this.uriToCst[uri],
    };
  }

  private async getSchemaRecords(ident: string) {
    const trimmedIdent = ident.replace(/[0-9]{2,}|\*$/, "");
    const columnRecords = await this.db.select(
      "SELECT DISTINCT column, data_type FROM columns WHERE table_name like ? || '%'",
      [trimmedIdent]
    );
    return columnRecords;
  }

  //private log(message: string) {
  //  this.connection.sendNotification("window/logMessage", {
  //    message: message,
  //  });
  //}

  public register() {
    this.documents.listen(this.connection);
    this.documents.onDidSave((change) => {
      this.dryRun(change.document.uri);
    });
    this.documents.onDidChangeContent((change) => {
      this.updateDocumentInfo(change);
    });
    this.documents.onDidOpen((change) => {
      const uri = change.document.uri;
      this.uriToText[uri] = "";
      this.uriToTokens[uri] = [];
      this.uriToCst[uri] = [];
      this.updateDocumentInfo(change);
    });
    // Register all the handlers for the LSP events.
    this.connection.onCompletion(this.onCompletion.bind(this));
    this.connection.onHover(this.onHover.bind(this));
    this.connection.onRequest(
      "bq/clearCache",
      this.onRequestClearCache.bind(this)
    );
    this.connection.onRequest("bq/dryRun", this.onRequestDryRun.bind(this));
    this.connection.onRequest(
      "textDocument/formatting",
      this.onRequestFormatting.bind(this)
    );
    this.connection.onRequest(
      "bq/updateCache",
      this.onRequestUpdateCache.bind(this)
    );
    this.connection.onShutdown(() => {
      this.db.close();
    });
  }

  private async onCompletion(
    position: LSP.CompletionParams
  ): Promise<LSP.CompletionItem[]> {
    /* NOTE
     * You can assume that change event comes before the completion request,
     * otherwise `process.nextTick()` might be needed.
     * https://github.com/Microsoft/vscode/issues/28458
     */
    /* NOTE
     * When this function returns [] (empty array),
     * VSCode's default completion works.
     * https://github.com/microsoft/vscode/issues/21611
     */
    const res: { label: string; detail?: string }[] = [];
    const line = position.position.line + 1;
    const column = position.position.character + 1;
    const currLiteral = util.getTokenByRowColumn(
      this.getDocInfo(position.textDocument.uri),
      line,
      column
    ).literal;
    const currCharacter =
      this.uriToText[position.textDocument.uri][
        util.getPositionByRowColumn(
          this.getDocInfo(position.textDocument.uri),
          line,
          column
        ) - 1
      ]; // `-1` is needed to capture just typed character
    if (currCharacter === "`") {
      const projects = (
        await this.db.select("SELECT DISTINCT project FROM columns;")
      ).map((x) => x.project);
      for (const project of projects) {
        res.push({ label: project });
      }
    } else if (currCharacter === ".") {
      const matchingResult = currLiteral.match(/^`([^`]+)`?$/);
      if (matchingResult) {
        const idents = matchingResult[1].split(".");
        const parent = idents[idents.length - 2];
        const projects = (
          await this.db.select("SELECT DISTINCT project FROM columns;")
        ).map((x) => x.project);
        const datasets: { project: string; dataset: string }[] =
          await this.db.select(
            "SELECT DISTINCT project, dataset FROM columns;"
          );
        const tables: { dataset: string; table_name: string }[] =
          await this.db.select(
            "SELECT DISTINCT dataset, table_name FROM columns;"
          );
        if (projects.includes(parent)) {
          datasets
            .filter((x) => x.project === parent)
            .forEach((x) => {
              res.push({ label: x.dataset });
            });
        } else if (datasets.map((x) => x.dataset).includes(parent)) {
          [
            ...new Set(
              tables
                .filter((x) => x.dataset === parent)
                .map((x) => x.table_name)
            ),
          ].forEach((x) => res.push({ label: x }));
        }
      } else {
        // completion out of `` is currently not supported
      }
    }
    return res;
  }

  private async onHover(params: LSP.TextDocumentPositionParams) {
    const uri = params.textDocument.uri;
    if (this.uriToCst[uri]) {
      const res = await this.provideHoverMessage(
        this.uriToCst[uri],
        params.position
      );
      return res;
    } else {
      return { contents: [] };
    }
  }

  private async onRequestClearCache(_: any) {
    this.db.clearCache();
    return "The cache was cleared successfully.";
  }

  private async onRequestDryRun(params: { uri: string }) {
    await this.dryRun(params.uri);
    return null;
  }

  private async onRequestFormatting(params: LSP.DocumentFormattingParams) {
    const config = await this.getConfiguration();
    const originalText = this.uriToText[params.textDocument.uri];
    const splittedOriginalText = originalText.split("\n");
    const formattedText = prettier
      .format(originalText, {
        parser: "sql-parse",
        ...config.formatting,
      })
      .slice(0, -1); // remove unnecessary \n
    return [
      {
        range: {
          start: { line: 0, character: 0 },
          end: {
            line: splittedOriginalText.length - 1,
            character:
              splittedOriginalText[splittedOriginalText.length - 1].length, // `-1` is not needed
          },
        },
        newText: formattedText,
      },
    ];
  }

  private async onRequestUpdateCache(_: any) {
    await this.db.updateCache(Object.values(this.uriToText));
    return "The cache was updated successfully.";
  }

  private async provideHoverMessage(
    cst: UnknownNode[],
    position: LSP.Position
  ) {
    const columns: string[] = [];
    async function checkCache(
      this: BQLanguageServer,
      node: UnknownNode,
      parent?: UnknownNode,
      _grandParent?: UnknownNode
    ) {
      if (node.token) {
        const literal = node.token.literal;
        const splittedLiteral = literal.split("\n");
        const startPosition = {
          line: node.token.line - 1,
          character: node.token.column - 1,
        };
        const endPosition = {
          line: startPosition.line + splittedLiteral.length - 1,
          character:
            splittedLiteral.length === 1
              ? startPosition.character + literal.length
              : splittedLiteral[splittedLiteral.length - 1].length - 1,
        };
        if (util.positionBetween(position, startPosition, endPosition)) {
          // TODO check parent and grandParent
          if (node.node_type === "Identifier") {
            const matchingResult = literal.match(/^`(.+)`$/);
            if (matchingResult) {
              const splittedIdentifier = matchingResult[1].split(".");
              const table = splittedIdentifier[splittedIdentifier.length - 1];
              const tables = await this.getSchemaRecords(table);
              tables.forEach((x) =>
                columns.push(`${x.column}: ${x.data_type}`)
              );
            } else {
              const tables = await this.getSchemaRecords(literal);
              tables.forEach((x) =>
                columns.push(`${x.column}: ${x.data_type}`)
              );
            }
          }
        } else {
          for (const [_, child] of Object.entries(node.children)) {
            if (child && "Node" in child) {
              await checkCache.call(this, child.Node, node, parent);
            } else if (child && "NodeVec" in child) {
              for (const n of child.NodeVec) {
                await checkCache.call(this, n, node, parent);
              }
            }
          }
        }
      }
    }
    // TODO parallelize
    for (const c of cst) {
      await checkCache.call(this, c);
    }
    return { contents: columns };
  }
  private updateDocumentInfo(
    change: LSP.TextDocumentChangeEvent<TextDocument>
  ) {
    const uri = change.document.uri;
    this.uriToText[uri] = change.document.getText();
    const text = change.document.getText();
    try {
      this.uriToTokens[uri] = tokenize(text);
      this.uriToCst[uri] = parse(text);
      this.connection.sendDiagnostics({
        uri: uri,
        diagnostics: [],
      });
    } catch (err) {
      if (err.line && err.column && err.message) {
        let errorPosition = { line: err.line - 1, character: err.column - 1 };
        const splittedText = text.trimEnd().split("\n");
        const finalCharaPosition = {
          line: splittedText.length - 1,
          character: splittedText[splittedText.length - 1].length - 1,
        };
        if (
          !util.positionBetween(
            errorPosition,
            { line: 0, character: 0 },
            finalCharaPosition
          )
        ) {
          errorPosition = finalCharaPosition;
        }
        // NOTE
        // https://code.visualstudio.com/api/language-extensions/language-server-extension-guide#diagnostics-tips-and-tricks
        // If the start and end positions are the same, VSCode will underline the word at that position.
        // Other editors may fail to underline.
        const diagnostic: LSP.Diagnostic = {
          severity: LSP.DiagnosticSeverity.Error,
          range: {
            start: errorPosition,
            end: errorPosition,
          },
          message: err.message,
        };
        this.connection.sendDiagnostics({
          uri: uri,
          diagnostics: [diagnostic],
        });
      }
    }
  }
}
