import * as LSP from "vscode-languageserver/node";
import { BigQuery } from "@google-cloud/bigquery";
import { TextDocument } from "vscode-languageserver-textdocument";
import { tokenize, parse, UnknownNode, Token } from "@dr666m1/bq2cst";
import * as prettier from "prettier";
import * as utils from "./utils";
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
  private async dryRun(textDocument: TextDocument): Promise<void> {
    const uri = textDocument.uri;
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
        msg = utils.formatBytes(
          Number(apiResponse.statistics.totalBytesProcessed)
        );
      } else {
        msg = "???B";
      }
      this.connection.sendDiagnostics({
        uri: uri,
        diagnostics: [],
      }); // clear old diagnostics
      this.connection.sendNotification("bq/dryRun", {
        totalBytesProcessed: msg,
      });
    } catch (e) {
      const msg = e.message;
      const matchResult = msg.match(/\[([0-9]+):([0-9]+)\]/);
      if (matchResult) {
        // in the case of message like below
        // Syntax error: Unexpected end of script at [1:7]
        const token = utils.getTokenByRowColumn(
          this.getDocInfo(uri),
          Number(matchResult[1]),
          Number(matchResult[2])
        );
        const position = utils.getPositionByRowColumn(
          this.getDocInfo(uri),
          token.line,
          token.column
        );
        diagnostic = {
          severity: LSP.DiagnosticSeverity.Error,
          range: {
            start: textDocument.positionAt(position),
            end: textDocument.positionAt(position + token.literal.length),
          },
          message: msg,
        };
      } else {
        // in the case of message like below
        // Table name "abc" missing dataset while no default dataset is set in the request
        diagnostic = {
          severity: LSP.DiagnosticSeverity.Error,
          range: {
            start: textDocument.positionAt(0),
            end: textDocument.positionAt(this.uriToText[uri].length),
          },
          message: msg,
        };
      }
      this.connection.sendDiagnostics({
        uri: uri,
        diagnostics: [diagnostic],
      });
      this.connection.sendNotification("bq/dryRun", {
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

  private async getMatchTables(ident: string) {
    const jsonObj = await this.db.dbAll(
      "SELECT DISTINCT table_name, column, data_type FROM schemas;"
    );
    return jsonObj.filter((x) => x.table_name === ident);
  }

  //private log(message: string) {
  //  this.connection.sendNotification("window/logMessage", {
  //    message: message,
  //  });
  //}

  public register() {
    this.documents.listen(this.connection);
    this.documents.onDidSave((change) => {
      this.dryRun(change.document);
      this.db.updateCache(Object.values(this.uriToText));
    });
    this.documents.onDidChangeContent((change) => {
      const uri = change.document.uri;
      this.uriToTokens[uri] = tokenize(change.document.getText());
      this.uriToText[uri] = change.document.getText();

      const originalConsoleError = console.error;
      console.error = () => {
        /* NOP */
      };
      try {
        this.uriToCst[uri] = parse(change.document.getText());
      } catch (err) {
        /* NOP */
      } finally {
        console.error = originalConsoleError;
      }
    });
    this.documents.onDidOpen((change) => {
      const uri = change.document.uri;
      this.uriToTokens[uri] = tokenize(change.document.getText());
      this.uriToText[uri] = change.document.getText();
      const originalConsoleError = console.error;
      console.error = () => {
        /* NOP */
      };
      try {
        this.uriToCst[uri] = parse(change.document.getText());
      } catch (err) {
        /* NOP */
      } finally {
        console.error = originalConsoleError;
      }
    });
    // Register all the handlers for the LSP events.
    this.connection.onCompletion(this.onCompletion.bind(this));
    this.connection.onHover(this.onHover.bind(this));
    this.connection.onRequest(
      "textDocument/formatting",
      this.onRequestFormatting.bind(this)
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
     */
    const res: { label: string; detail?: string }[] = [];
    const line = position.position.line + 1;
    const column = position.position.character + 1;
    const currLiteral = utils.getTokenByRowColumn(
      this.getDocInfo(position.textDocument.uri),
      line,
      column
    ).literal;
    const currCharacter =
      this.uriToText[position.textDocument.uri][
        utils.getPositionByRowColumn(
          this.getDocInfo(position.textDocument.uri),
          line,
          column
        ) - 1
      ]; // `-1` is needed to capture just typed character
    if (currCharacter === "`") {
      const projects = (
        await this.db.dbAll("SELECT DISTINCT project FROM schemas;")
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
          await this.db.dbAll("SELECT DISTINCT project FROM schemas;")
        ).map((x) => x.project);
        const datasets: { project: string; dataset: string }[] =
          await this.db.dbAll("SELECT DISTINCT project, dataset FROM schemas;");
        const tables: { dataset: string; table_name: string }[] =
          await this.db.dbAll(
            "SELECT DISTINCT dataset, table_name FROM schemas;"
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
        if (utils.positionBetween(position, startPosition, endPosition)) {
          // TODO check parent and grandParent
          if (node.node_type === "Identifier") {
            const matchingResult = literal.match(/^`(.+)`$/);
            if (matchingResult) {
              const splittedIdentifier = matchingResult[1].split(".");
              const table = splittedIdentifier[splittedIdentifier.length - 1];
              const tables = await this.getMatchTables(table);
              tables.forEach((x) =>
                columns.push(`${x.column}: ${x.data_type}`)
              );
            } else {
              const tables = await this.getMatchTables(literal);
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
}
