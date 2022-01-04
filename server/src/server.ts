import * as LSP from "vscode-languageserver/node";
import { BigQuery } from "@google-cloud/bigquery";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as bq2cst from "@dr666m1/bq2cst";
import * as prettier from "prettier";
import * as util from "./util";
import { CacheDB } from "./database";
import { globalFunctions, notGlobalFunctions } from "./functions";
import { execSync } from "child_process";

declare module "@dr666m1/bq2cst" {
  interface BaseNode {
    extendedWithQueries?: bq2cst.WithQuery[];
    parent?: WeakRef<bq2cst.UnknownNode>;
    range: {
      start: LSP.Position | null;
      end: LSP.Position | null;
    };
  }
}

type CompletionItem = {
  parent?: string;
  type?: string;
  name: string;
};

export type NameSpace = {
  start: { line: number; column: number };
  end: { line: number; column: number };
  variables: CompletionItem[];
};

type Configuration = {
  diagnostic: {
    dryRunOnSave: boolean;
    forVSCode: boolean;
  };
  formatting: Record<string, boolean>;
};

const defaultConfiguration: Configuration = {
  diagnostic: {
    dryRunOnSave: true,
    forVSCode: false,
  },
  formatting: {},
};

export class BQLanguageServer {
  public static async initialize(
    connection: LSP.Connection,
    db: CacheDB,
    capabilities: Record<string, boolean>
  ): Promise<BQLanguageServer> {
    return new BQLanguageServer(connection, db, capabilities);
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
  private configurations: Map<string, Thenable<Configuration>> = new Map();
  private defaultProject: string;
  private documents: LSP.TextDocuments<TextDocument> = new LSP.TextDocuments(
    TextDocument
  );
  private hasConfigurationCapability: boolean;
  private uriToCst: Record<string, bq2cst.UnknownNode[]> = {};
  private uriToText: Record<string, string> = {};
  private uriToTokens: Record<string, bq2cst.Token[]> = {};
  private constructor(
    private connection: LSP.Connection,
    private db: CacheDB,
    capabilities: Record<string, boolean>
  ) {
    this.defaultProject = (
      execSync(" gcloud config get-value project") + ""
    ).trim();
    this.hasConfigurationCapability = capabilities.hasConfigurationCapability;
  }
  private async dryRun(uri: LSP.URI): Promise<void> {
    let diagnostic: LSP.Diagnostic;
    try {
      // See https://cloud.google.com/bigquery/docs/dry-run-queries
      let msg;
      const [job] = await this.bqClient.createQueryJob({
        query: this.uriToText[uri],
        dryRun: true,
      });
      if (
        job.metadata.statistics &&
        job.metadata.statistics.totalBytesProcessed
      ) {
        msg = util.formatBytes(
          Number(job.metadata.statistics.totalBytesProcessed)
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
      const range = util.getTokenRangeByRowColumn(
        this.getDocInfo(uri),
        Number(matchResult[1]),
        Number(matchResult[2])
      );
      if (matchResult && range) {
        // in the case of message like below
        // Syntax error: Unexpected end of script at [1:7]
        diagnostic = {
          severity: LSP.DiagnosticSeverity.Error,
          range: range,
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

  private getConfiguration(uri: string): Thenable<Configuration> {
    function replace(
      defaultConfig: Record<string, unknown>,
      userConfig: Record<string, unknown>
    ) {
      for (const k of Object.keys(defaultConfig)) {
        if (
          typeof defaultConfig[k] === "object" &&
          k in userConfig &&
          typeof userConfig[k] === "object"
        ) {
          replace(
            defaultConfig[k] as Record<string, unknown>,
            userConfig[k] as Record<string, unknown>
          );
        } else if (k in userConfig && typeof userConfig[k] !== "object") {
          defaultConfig[k] = userConfig[k];
        }
      }
    }

    if (!this.hasConfigurationCapability) {
      return Promise.resolve(defaultConfiguration);
    }
    let result = this.configurations.get(uri);
    if (!result) {
      result = this.connection.workspace
        .getConfiguration({
          section: "bqExtensionVSCode",
        })
        .then((res) => {
          const config = JSON.parse(JSON.stringify(defaultConfiguration)); // deep copy
          replace(config, res);
          return config;
        });
      this.configurations.set(uri, result);
    }
    return result;
  }

  private getDocInfo(uri: string) {
    return {
      text: this.uriToText[uri],
      tokens: this.uriToTokens[uri],
      cst: this.uriToCst[uri],
    };
  }

  private getSmallestNameSpace(nameSpaces: NameSpace[]) {
    if (nameSpaces.length === 0) {
      return null;
    }
    let smallestNameSpace = nameSpaces[0];
    for (let i = 1; i < nameSpaces.length; i++) {
      if (
        util.positionBetween(
          {
            line: nameSpaces[i].start.line,
            character: nameSpaces[i].start.column,
          },
          {
            line: smallestNameSpace.start.line,
            character: smallestNameSpace.start.column,
          },
          {
            line: smallestNameSpace.end.line,
            character: smallestNameSpace.end.column,
          }
        ) &&
        util.positionBetween(
          {
            line: nameSpaces[i].end.line,
            character: nameSpaces[i].end.column,
          },
          {
            line: smallestNameSpace.start.line,
            character: smallestNameSpace.start.column,
          },
          {
            line: smallestNameSpace.end.line,
            character: smallestNameSpace.end.column,
          }
        )
      ) {
        smallestNameSpace = nameSpaces[i];
      }
    }
    return smallestNameSpace;
  }

  public register() {
    this.documents.listen(this.connection);
    this.documents.onDidSave((change) => {
      this.getConfiguration(change.document.uri).then((config) => {
        if (config.diagnostic.dryRunOnSave) this.dryRun(change.document.uri);
      });
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
    this.connection.onDidChangeConfiguration(
      this.onDidChangeConfiguration.bind(this)
    );
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
    const res: {
      label: string;
      documentation?: string | LSP.MarkupContent;
      kind?: LSP.CompletionItemKind;
    }[] = [];
    const uri = position.textDocument.uri;
    // line, column... position of just typed character (1 based index)
    const line = position.position.line + 1;
    const column = position.position.character;
    const currToken = util.getTokenByRowColumn(
      this.getDocInfo(position.textDocument.uri),
      line,
      column
    );
    if (!currToken) {
      return [];
    }
    const currLiteral = currToken.literal;

    const currCharacter =
      this.uriToText[position.textDocument.uri][
        util.getPositionByRowColumn(
          this.getDocInfo(position.textDocument.uri),
          line,
          column
        )
      ];
    if (currCharacter === "`") {
      const projects = (
        await this.db.query("SELECT DISTINCT project FROM projects;", [
          "project",
        ])
      ).map((x: { project: string }) => x.project);
      for (const project of projects) {
        res.push({ label: project });
      }
    } else if (currCharacter === ".") {
      const matchingResult = currLiteral.match(/^`([^`]+)`?$/);
      if (matchingResult) {
        // in ``
        const idents = matchingResult[1].split(".");
        const length = idents.length;
        const datasetsOfDefaultProject = (
          await this.db.query(
            "SELECT DISTINCT dataset FROM datasets WHERE project = ?;",
            [this.defaultProject],
            ["dataset"]
          )
        ).map((x) => x.dataset);
        if (datasetsOfDefaultProject.some((x) => x === idents[0])) {
          // idents[0] is assumed to be dataset name (of defaultProject)
          const tables: string[] = (
            await this.db.query(
              "SELECT DISTINCT table_name FROM columns WHERE project = ? AND dataset = ?",
              [this.defaultProject, idents[0]],
              ["table_name"]
            )
          ).map((x: { table_name: string }) => x.table_name);
          tables.forEach((table) => {
            res.push({ label: table, kind: LSP.CompletionItemKind.Field });
          });
        } else {
          // idents[0] is assumed to be project name
          if (length === 2) {
            const datasets: string[] = (
              await this.db.query(
                "SELECT DISTINCT dataset FROM datasets WHERE project = ?",
                [idents[0]],
                ["dataset"]
              )
            ).map((x: { dataset: string }) => x.dataset);
            datasets.forEach((dataset) => {
              res.push({ label: dataset, kind: LSP.CompletionItemKind.Field });
            });
          } else if (length === 3) {
            const tables: string[] = (
              await this.db.query(
                "SELECT DISTINCT table_name FROM columns WHERE project = ? AND dataset = ?",
                [idents[0], idents[1]],
                ["table_name"]
              )
            ).map((x: { table_name: string }) => x.table_name);
            tables.forEach((table) => {
              res.push({ label: table, kind: LSP.CompletionItemKind.Field });
            });
          } else {
            // something went wrong!
          }
        }
      } else {
        // out of ``
        const currIndex = util.getPositionByRowColumn(
          this.getDocInfo(uri),
          line,
          column
        );
        const newText = this.uriToText[uri];
        const oldText =
          newText.substring(0, currIndex) + newText.substring(currIndex + 1);
        let nameSpaces = await this.createNameSpacesFromText(oldText);
        nameSpaces = nameSpaces.filter((ns) =>
          util.positionBetween(
            { line: line, character: column - 1 }, // position of the character before `.`
            { line: ns.start.line, character: ns.start.column },
            { line: ns.end.line, character: ns.end.column }
          )
        );
        const tokens = this.uriToTokens[uri];
        let idx = 0;
        tokens.forEach((t, i) => {
          if (t.line === line && t.column <= column) {
            idx = i;
          }
        });
        if (idx === 0) {
          // Something went wrong! Return empty result.
        } else {
          const parent = tokens[idx - 1].literal;
          let largestNameSpace: NameSpace = {
            // position of the character before `.`
            start: { line: line, column: column - 1 },
            end: { line: line, column: column - 1 },
            variables: [],
          };
          for (const n of nameSpaces) {
            if (
              util.positionBetween(
                {
                  line: largestNameSpace.start.line,
                  character: largestNameSpace.start.column,
                },
                { line: n.start.line, character: n.start.column },
                { line: n.end.line, character: n.end.column }
              ) &&
              util.positionBetween(
                {
                  line: largestNameSpace.end.line,
                  character: largestNameSpace.end.column,
                },
                { line: n.start.line, character: n.start.column },
                { line: n.end.line, character: n.end.column }
              ) &&
              n.end.line !== Number.MAX_SAFE_INTEGER
            ) {
              largestNameSpace = n;
            }
          }
          nameSpaces.forEach((n) => {
            n.variables.forEach((v) => {
              if (v.parent === parent) {
                res.push({
                  label: v.name,
                  kind: LSP.CompletionItemKind.Field,
                  documentation: `Table: ${v.parent || "unknown"}, Type: ${
                    v.type || "unknown"
                  }`,
                });
              }
            });
          });
          // in the case of STRUCT
          type Variable = { label: string; type: string };
          if (res.length === 0) {
            // without table name
            let ancestorIdx = idx;
            while (
              0 < ancestorIdx - 2 &&
              tokens[ancestorIdx - 2].literal === "."
            ) {
              ancestorIdx -= 2;
            }
            const nDots = (idx - ancestorIdx) / 2 + 1;
            ancestorIdx -= 1;
            let variables: Variable[];
            if (nameSpaces.length === 0) {
              variables = [];
            } else {
              variables = this.getSmallestNameSpace(nameSpaces)!.variables.map(
                (v) => {
                  return { label: v.name, type: v.type || "UNKNOWN" };
                }
              );
            }
            for (let i = 0; i < nDots; i++) {
              const newVariables: Variable[] = [];
              variables.forEach((v) => {
                if (v.label === tokens[ancestorIdx].literal && v.type) {
                  const mattingResult = v.type.match(/^STRUCT<(.+)>$/);
                  if (mattingResult) {
                    util.parseType(mattingResult[1]).forEach((vt) => {
                      const spacePosition = vt.search(" ");
                      newVariables.push({
                        label: vt.substring(0, spacePosition),
                        type: vt.substring(spacePosition + 1),
                      });
                    });
                  }
                }
              });
              variables = newVariables;
              ancestorIdx += 2;
            }
            variables.forEach((v) => {
              res.push({
                label: v.label,
                documentation: `Type: ${v.type}`,
                kind: LSP.CompletionItemKind.Field,
              });
            });
          }
          if (res.length === 0) {
            // with table name
            let ancestorIdx = idx;
            while (
              0 < ancestorIdx - 2 &&
              tokens[ancestorIdx - 2].literal === "."
            ) {
              ancestorIdx -= 2;
            }
            const nDots = (idx - ancestorIdx) / 2 + 1;
            ancestorIdx -= 1;
            let variables: Variable[] = [];
            nameSpaces.forEach((n) => {
              n.variables.forEach((v) => {
                if (v.parent === tokens[ancestorIdx].literal) {
                  variables.push({
                    label: v.name,
                    type: v.type || "UNKNOWN",
                  });
                }
              });
            });
            ancestorIdx += 2;
            for (let i = 0; i < nDots - 1; i++) {
              const newVariables: Variable[] = [];
              variables.forEach((v) => {
                if (v.label === tokens[ancestorIdx].literal && v.type) {
                  const mattingResult = v.type.match(/^STRUCT<(.+)>$/);
                  if (mattingResult) {
                    util.parseType(mattingResult[1]).forEach((vt) => {
                      const spacePosition = vt.search(" ");
                      newVariables.push({
                        label: vt.substring(0, spacePosition),
                        type: vt.substring(spacePosition + 1),
                      });
                    });
                  }
                }
              });
              variables = newVariables;
              ancestorIdx += 2;
            }
            variables.forEach((v) => {
              res.push({
                label: v.label,
                documentation: `Type: ${v.type}`,
                kind: LSP.CompletionItemKind.Field,
              });
            });
          }
        }
      }
    } else {
      let nameSpaces = await this.createNameSpaces(uri);
      nameSpaces = nameSpaces.filter((ns) =>
        util.positionBetween(
          { line: line, character: column },
          { line: ns.start.line, character: ns.start.column },
          { line: ns.end.line, character: ns.end.column }
        )
      );
      if (nameSpaces.length !== 0) {
        const smallestNameSpace = this.getSmallestNameSpace(nameSpaces)!;
        const parents = new Set(
          smallestNameSpace.variables.map((x) => x.parent)
        );
        parents.forEach((x) => {
          if (x && !x.includes(".")) {
            // remove `project.dataset.table`
            res.push({ label: x, kind: LSP.CompletionItemKind.Struct });
          }
        });
        smallestNameSpace.variables.forEach((variable) => {
          res.push({
            label: variable.name,
            kind: LSP.CompletionItemKind.Field,
            documentation: `Table: ${variable.parent || "unknown"}, Type: ${
              variable.type || "unknown"
            }`,
          });
        });
      }
      /*
       * Reserved keywords and functions are not suggested without leading characters.
       * If they are suggested, it will be difficult to find the column you want.
       */
      if (res.length === 0 || !currCharacter.match(/^[, ]$/)) {
        globalFunctions.forEach((x) => {
          if (typeof x === "string") {
            res.push({ label: x, kind: LSP.CompletionItemKind.Function });
          } else {
            res.push({
              label: x.ident,
              kind: LSP.CompletionItemKind.Function,
              documentation: util.convert2MarkdownContent(x.example),
            });
          }
        });
      }
    }

    // get unique result
    return Array.from(new Set(res.map((x) => JSON.stringify(x)))).map((x) =>
      JSON.parse(x)
    );
  }

  private onDidChangeConfiguration(_: LSP.DidChangeConfigurationParams) {
    this.configurations.clear();
  }

  private async onHover(params: LSP.TextDocumentPositionParams) {
    const uri = params.textDocument.uri;
    const res = await this.provideHoverMessage(
      this.getDocInfo(uri),
      params.position
    );
    return res;
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
    const config = await this.getConfiguration(params.textDocument.uri);
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
    docInfo: util.DocumentInfo,
    position: LSP.Position
  ) {
    const node = util.getNodeByRowColumn(
      docInfo,
      position.line + 1,
      position.character + 1
    );
    if (!node || !node.token) {
      // unexpected case!
      return { contents: [] };
    }
    const idents = util.parseIdentifier(node);

    // hover about functions
    if (idents.length === 1) {
      const i = idents[0].toUpperCase();
      for (const f of globalFunctions) {
        if (typeof f === "string") {
          if (i === f) {
            return { contents: [] };
          }
        } else {
          if (i === f.ident) {
            return { contents: util.convert2MarkdownContent(f.example) };
          }
        }
      }
    } else if (idents.length === 2) {
      const key = idents[0].toUpperCase();
      const i = idents[1].toUpperCase();
      if (key in notGlobalFunctions) {
        const functions = notGlobalFunctions[key];
        for (const f of functions) {
          if (typeof f === "string") {
            if (i === f) {
              return { contents: [] };
            }
          } else {
            if (i === f.ident) {
              return { contents: util.convert2MarkdownContent(f.example) };
            }
          }
        }
      }
    }

    // hover about table
    type QueryResult = {
      column: string;
      data_type: string;
    };
    function replaceTableSuffix(s: string) {
      return s.replace(/([^0-9])[0-9]{8}$/, "$1*");
    }
    if (idents.length === 1) {
      // TODO support default dataset
    } else if (idents.length === 2) {
      const dataset = idents[0];
      const table = replaceTableSuffix(idents[1]);
      const queryResults: QueryResult[] = await this.db.query(
        `SELECT DISTINCT column, data_type FROM columns WHERE project = ? AND dataset = ? AND table_name = ?;`,
        [this.defaultProject, dataset, table],
        ["column", "data_type"]
      );
      return {
        contents: util.convert2MarkdownItems(
          queryResults.map((row) => `${row.column}: ${row.data_type}`)
        ),
      };
    } else if (idents.length === 3) {
      const project = idents[0];
      const dataset = idents[1];
      const table = replaceTableSuffix(idents[2]);
      const queryResults: QueryResult[] = await this.db.query(
        `SELECT DISTINCT column, data_type FROM columns WHERE project = ? AND dataset = ? AND table_name = ?;`,
        [project, dataset, table],
        ["column", "data_type"]
      );
      return {
        contents: util.convert2MarkdownItems(
          queryResults.map((row) => `${row.column}: ${row.data_type}`)
        ),
      };
    }
    return { contents: [] };
  }

  private updateDocumentInfo(
    change: LSP.TextDocumentChangeEvent<TextDocument>
  ) {
    function setParentAndRange(parent: bq2cst.UnknownNode) {
      const weakref = new WeakRef(parent);
      parent.range = {
        start: null,
        end: null,
      };
      const token = parent.token;
      if (token) {
        parent.range.start = { line: token.line, character: token.column };
        const splittedLiteral = token.literal.split("\n");
        parent.range.end = {
          line: token.line + splittedLiteral.length - 1,
          character:
            splittedLiteral.length === 1
              ? token.column + token.literal.length - 1
              : splittedLiteral[splittedLiteral.length - 1].length,
        };
      }
      for (const [_, child] of Object.entries(parent.children)) {
        if (!child) {
          continue;
        } else if ("Node" in child) {
          child.Node.parent = weakref;
          setParentAndRange(child.Node);
          if (
            parent.range.start &&
            child.Node.range.start &&
            util.positionFormer(child.Node.range.start, parent.range.start)
          ) {
            parent.range.start = child.Node.range.start;
          } else if (!parent.range.start && child.Node.range.start) {
            parent.range.start = child.Node.range.start;
          }
          if (
            parent.range.end &&
            child.Node.range.end &&
            util.positionFormer(parent.range.end, child.Node.range.end)
          ) {
            parent.range.end = child.Node.range.end;
          } else if (!parent.range.end && child.Node.range.end) {
            parent.range.end = child.Node.range.end;
          }
        } else {
          child.NodeVec.forEach((node) => {
            node.parent = weakref;
            setParentAndRange(node);
            if (
              parent.range.start &&
              node.range.start &&
              util.positionFormer(node.range.start, parent.range.start)
            ) {
              parent.range.start = node.range.start;
            } else if (!parent.range.start && node.range.start) {
              parent.range.start = node.range.start;
            }
            if (
              parent.range.end &&
              node.range.end &&
              util.positionFormer(parent.range.end, node.range.end)
            ) {
              parent.range.end = node.range.end;
            } else if (!parent.range.end && node.range.end) {
              parent.range.end = node.range.end;
            }
          });
        }
      }
    }
    const uri = change.document.uri;
    this.uriToText[uri] = change.document.getText();
    const text = change.document.getText();
    try {
      this.uriToTokens[uri] = bq2cst.tokenize(text);
      const csts = bq2cst.parse(text);
      csts.forEach((cst) => setParentAndRange(cst));
      this.uriToCst[uri] = csts;
      this.connection.sendDiagnostics({
        uri: uri,
        diagnostics: [],
      });
    } catch (err: any) {
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
        this.getConfiguration(uri).then((config) => {
          const diagnostic: LSP.Diagnostic = {
            severity: LSP.DiagnosticSeverity.Error,
            range: {
              start: errorPosition,
              end: config.diagnostic.forVSCode
                ? errorPosition
                : {
                    line: errorPosition.line,
                    character: errorPosition.character + 1,
                  },
            },
            message: err.message,
          };
          this.connection.sendDiagnostics({
            uri: uri,
            diagnostics: [diagnostic],
          });
        });
      }
    }
  }

  private async createNameSpaces(uri: string): Promise<NameSpace[]> {
    const cst: bq2cst.UnknownNode[] = JSON.parse(
      JSON.stringify(this.uriToCst[uri])
    ); // deep copy
    const nameSpaces: NameSpace[] = [];
    const promises = cst.map((node) => {
      return this.pushNameSpaceOfNode(node, nameSpaces);
    });
    await Promise.all(promises);
    return nameSpaces;
  }

  private async createNameSpacesFromText(text: string): Promise<NameSpace[]> {
    const cst = bq2cst.parse(text);
    const nameSpaces: NameSpace[] = [];
    const promises = cst.map((node) => {
      return this.pushNameSpaceOfNode(node, nameSpaces);
    });
    await Promise.all(promises);
    return nameSpaces;
  }

  private async pushNameSpaceOfNode(
    node: bq2cst.UnknownNode,
    parent: NameSpace[]
  ) {
    if (node.node_type === "SelectStatement") {
      const variables: CompletionItem[] = [];
      const range = util.getNodeRange(node);
      if (!range) {
        throw new Error("something went wrong!");
      }
      let with_: bq2cst.WithClause | undefined = undefined;
      if (node.children.with) {
        with_ = node.children.with.Node;
        with_.children.queries.NodeVec.map((n, i) => {
          const groupedStatement = n.children.stmt.Node;
          groupedStatement.children.stmt.Node.extendedWithQueries =
            with_!.children.queries.NodeVec.slice(0, i);
        });
      }
      const from = node.children.from;
      if (from && from.Node.node_type === "KeywordWithExpr") {
        await this.findVariablesInsideSelectStatment(
          variables,
          from.Node,
          with_,
          node.extendedWithQueries
        );
      }
      parent.push({
        start: range.start,
        end: range.end,
        variables: variables,
      });
    } else if (node.node_type === "SetOperator") {
      if (node.children.with) {
        const with_ = node.children.with.Node;
        with_.children.queries.NodeVec.map((n, i) => {
          const groupedStatement = n.children.stmt.Node;
          groupedStatement.children.stmt.Node.extendedWithQueries =
            with_!.children.queries.NodeVec.slice(0, i);
        });
        node.children.left.Node.extendedWithQueries =
          node.children.with.Node.children.queries.NodeVec;
        node.children.right.Node.extendedWithQueries =
          node.children.with.Node.children.queries.NodeVec;
      } else if (node.extendedWithQueries) {
        node.children.left.Node.extendedWithQueries = node.extendedWithQueries;
        node.children.right.Node.extendedWithQueries = node.extendedWithQueries;
      }
    } else if (node.node_type === "GroupedStatement") {
      if (node.children.with) {
        const with_ = node.children.with.Node;
        with_.children.queries.NodeVec.map((n, i) => {
          const groupedStatement = n.children.stmt.Node;
          groupedStatement.children.stmt.Node.extendedWithQueries =
            with_!.children.queries.NodeVec.slice(0, i);
        });
        node.children.stmt.Node.extendedWithQueries =
          node.children.with.Node.children.queries.NodeVec;
      } else if (node.extendedWithQueries) {
        node.children.stmt.Node.extendedWithQueries = node.extendedWithQueries;
      }
    }
    const promises = util.getAllChildren(node).map((child) => {
      return this.pushNameSpaceOfNode(child, parent);
    });
    await Promise.all(promises);
  }

  private async findVariablesInsideSelectStatment(
    output: CompletionItem[],
    from: bq2cst.KeywordWithExpr,
    with_?: bq2cst.WithClause,
    extendedWithQueries?: bq2cst.WithQuery[]
  ) {
    async function findVariable(
      this: BQLanguageServer,
      fromItem: bq2cst.UnknownNode,
      parent?: string
    ) {
      if (fromItem.node_type === "JoinOperator") {
        await findVariable.call(this, fromItem.children.left.Node);
        await findVariable.call(this, fromItem.children.right.Node);
      } else if (fromItem.node_type === "Identifier") {
        const literal = fromItem.token.literal;
        const explicitAlias =
          fromItem.children.alias && fromItem.children.alias.Node.token
            ? fromItem.children.alias.Node.token.literal
            : undefined;
        const matchingResult = literal.match(/^`(.+)`$/);
        if (matchingResult) {
          const idents = matchingResult[1].split(".");
          if (idents.length === 3) {
            // idents[0] is assumed to be project
            const columns = (
              await this.db.query(
                "SELECT DISTINCT column, data_type FROM columns WHERE project = ? AND dataset = ? AND table_name = ?;",
                [idents[0], idents[1], idents[2]],
                ["column", "data_type"]
              )
            ).map((x: { column: string; data_type: string }) => {
              return { name: x.column, type: x.data_type };
            });
            columns.forEach((column: { name: string; type: string }) => {
              output.push({
                name: column.name,
                parent: explicitAlias || literal,
                type: column.type,
              });
            });
          } else if (idents.length == 2) {
            // idents[0] is assumed to be dataset
            const columns = (
              await this.db.query(
                "SELECT DISTINCT column, data_type FROM columns WHERE project = ? AND dataset = ? AND table_name = ?;",
                [this.defaultProject, idents[0], idents[1]],
                ["column", "data_type"]
              )
            ).map((x: { column: string; data_type: string }) => {
              return { name: x.column, type: x.data_type };
            });
            columns.forEach((column: { name: string; type: string }) => {
              output.push({
                name: column.name,
                parent: explicitAlias || literal,
                type: column.type,
              });
            });
          }
        } else {
          const promises: Promise<void>[] = [];
          const withQueryStatements: { [key: string]: bq2cst.UnknownNode } = {};
          if (extendedWithQueries) {
            // NOTE extendedWithQueries are overwritten by withClause
            extendedWithQueries.forEach((query) => {
              const alias = query.token.literal;
              withQueryStatements[alias] = query.children.stmt.Node;
            });
          }
          if (with_) {
            with_.children.queries.NodeVec.forEach((query) => {
              const alias = query.token.literal;
              withQueryStatements[alias] = query.children.stmt.Node;
            });
          }
          for (const [k, v] of Object.entries(withQueryStatements)) {
            if (k === literal) {
              promises.push(findVariable.call(this, v, explicitAlias || k));
            }
          }
          await Promise.all(promises);
        }
      } else if (fromItem.node_type === "GroupedStatement") {
        // in the case of subquery or with CTE (a statement in WITH clause)
        let stmt = fromItem.children.stmt.Node;
        const explicitAlias =
          fromItem.children.alias && fromItem.children.alias.Node.token
            ? fromItem.children.alias.Node.token.literal
            : undefined;
        if (stmt.node_type === "SetOperator") {
          stmt = stmt.children.left.Node;
        }
        if (stmt.node_type === "SelectStatement") {
          const unknowns = stmt.children.exprs.NodeVec;
          unknowns.forEach((unknown) => {
            const expr = unknown as bq2cst.Expr; // to satisfy compiler
            if (expr.children.alias) {
              output.push({
                name: expr.children.alias.Node.token.literal,
                parent: explicitAlias || parent, // `parent` is passed by withQuery
              });
            } else if (unknown.node_type === "Identifier") {
              output.push({
                name: unknown.token.literal,
                parent: explicitAlias || parent, // `parent` is passed by withQuery
              });
            }
          });
        } else if (stmt.node_type === "GroupedStatement") {
          await findVariable.call(
            this,
            stmt, // you can ignore right
            explicitAlias || parent
          );
        }
      }
    }
    const fromItem = from.children.expr.Node;
    await findVariable.call(this, fromItem);
  }
}
