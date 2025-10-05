import * as LSP from "vscode-languageserver/node";
import { BigQuery } from "@google-cloud/bigquery";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as bq2cst from "bq2cst";
import * as prettier from "prettier";
import * as util from "./util";
import { NeDB } from "./database";
import { globalFunctions, notGlobalFunctions } from "./functions";
import * as prettierPluginBQ from "prettier-plugin-bq";

declare module "bq2cst" {
  interface BaseNode {
    extendedWithQueries?: bq2cst.WithQuery[];
    parent?: WeakRef<bq2cst.UnknownNode>;
    range: {
      start: LSP.Position | null;
      end: LSP.Position | null;
    };
  }
}

type Configuration = {
  diagnostic: {
    dryRunOnSave: boolean;
    forVSCode: boolean;
  };
  formatting: Record<string, boolean>;
  experimental: {
    formatEachLine: boolean;
  };
  project: { targetProjects: string[] };
};

const defaultConfiguration: Configuration = {
  diagnostic: {
    dryRunOnSave: true,
    forVSCode: false,
  },
  formatting: {},
  experimental: {
    formatEachLine: false,
  },
  project: {
    targetProjects: [],
  },
};

type QueryResult = {
  column: string;
  data_type: string;
};

type NameSpace = {
  start: LSP.Position;
  end: LSP.Position;
  name?: string;
  variables: CompletionItem[];
};

type CompletionItem = {
  label: string;
  info: Record<string, string>;
  kind: LSP.CompletionItemKind;
};

export class BQLanguageServer {
  public static async initialize(
    connection: LSP.Connection,
    db: NeDB,
    capabilities: Record<string, boolean>,
  ): Promise<BQLanguageServer> {
    const server = new BQLanguageServer(connection, db, capabilities);
    if (process.env.CI === "true") {
      server.defaultProject = "bq-extension-vscode";
      return server;
    }

    try {
      await server.bqClient.getProjectId();
      server.defaultProject = server.bqClient.projectId;
    } catch {
      // even if something went wrong, completion and hover would work
    }
    return server;
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
  private defaultProject: string = "";
  private documents: LSP.TextDocuments<TextDocument> = new LSP.TextDocuments(
    TextDocument,
  );
  private hasConfigurationCapability: boolean;
  private uriToCst: Record<string, bq2cst.UnknownNode[]> = {};
  private uriToText: Record<string, string> = {};
  private uriToTokens: Record<string, bq2cst.Token[]> = {};
  private constructor(
    private connection: LSP.Connection,
    private db: NeDB,
    capabilities: Record<string, boolean>,
  ) {
    this.hasConfigurationCapability = capabilities.hasConfigurationCapability;
  }
  private async dryRun(uri: LSP.URI): Promise<void> {
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
          Number(job.metadata.statistics.totalBytesProcessed),
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
      const config = await this.getConfiguration(uri);
      if (!config.diagnostic.forVSCode) {
        const params: LSP.ShowMessageParams = {
          message: `This query will process ${msg} when run.`,
          type: LSP.MessageType.Info,
        };
        this.connection.sendNotification("window/showMessage", params);
      }
    } catch (e: any) {
      const msg = e.message;

      // in the case of message like below
      // Table name "abc" missing dataset while no default dataset is set in the request
      const splittedText = this.uriToText[uri].split("\n");
      const diagnostic = {
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

      // in the case of message like below
      // Syntax error: Unexpected end of script at [1:7]
      const matchResult = msg.match(/\[([0-9]+):([0-9]+)\]/);
      if (matchResult) {
        const range = util.getTokenRangeByRowColumn(
          this.getDocInfo(uri),
          Number(matchResult[1]),
          Number(matchResult[2]),
        );
        if (range) diagnostic.range = range;
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
      userConfig: Record<string, unknown>,
    ) {
      for (const k of Object.keys(userConfig)) {
        if (
          k in defaultConfig &&
          typeof defaultConfig[k] === "object" &&
          typeof userConfig[k] === "object"
        ) {
          replace(
            defaultConfig[k] as Record<string, unknown>,
            userConfig[k] as Record<string, unknown>,
          );
        } else if (
          k in defaultConfig &&
          typeof defaultConfig[k] === typeof userConfig[k]
        ) {
          defaultConfig[k] = userConfig[k];
        } else if (!(k in defaultConfig)) {
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

  private getSmallestNameSpaces(nameSpaces: NameSpace[]) {
    if (nameSpaces.length <= 1) {
      return nameSpaces;
    }

    let res = [nameSpaces[0]];
    for (let i = 1; i < nameSpaces.length; i++) {
      if (util.rangeContains(res[0], nameSpaces[i])) {
        if (util.rangeContains(nameSpaces[i], res[0])) {
          // nameSpaces[i] has the same range
          res.push(nameSpaces[i]);
        } else {
          // nameSpaces[i] is smaller
          res = [nameSpaces[i]];
        }
      } else {
        continue;
      }
    }

    return res;
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
      this.onDidChangeConfiguration.bind(this),
    );
    this.connection.onHover(this.onHover.bind(this));
    this.connection.onRequest(
      "bq/clearCache",
      this.onRequestClearCache.bind(this),
    );
    this.connection.onRequest("bq/dryRun", this.onRequestDryRun.bind(this));
    this.connection.onRequest(
      "textDocument/formatting",
      this.onRequestFormatting.bind(this),
    );
    this.connection.onRequest(
      "bq/updateCache",
      this.onRequestUpdateCache.bind(this),
    );
    this.connection.onRequest(
      "bq/addToCache",
      this.onRequestAddToCache.bind(this),
    );
    this.connection.onRequest(
      "bq/dumpCache",
      this.onRequestDumpCache.bind(this),
    );
    this.connection.onShutdown(() => {
      // close the db connection if needed
    });
  }

  private async onCompletion(
    position: LSP.CompletionParams,
  ): Promise<LSP.CompletionItem[]> {
    const res: {
      label: string;
      documentation?: LSP.MarkupContent;
      kind: LSP.CompletionItemKind;
    }[] = [];
    const uri = position.textDocument.uri;
    const line = position.position.line + 1;
    const column = position.position.character;
    const node = util.getNodeByRowColumn(
      this.getDocInfo(uri).cst,
      line,
      column,
    );
    const char =
      this.uriToText[position.textDocument.uri][
        util.getPositionByRowColumn(
          this.getDocInfo(position.textDocument.uri),
          line,
          column,
        )
      ];
    const config = await this.getConfiguration(uri);
    const lowercaseFunction: boolean =
      "printKeywordsInUpperCase" in config.formatting &&
      !config.formatting.printKeywordsInUpperCase;
    if (char === ".") {
      // NOTE Check not cst but token here because `.` often breaks cst.
      const token = util.getTokenByRowColumn(
        this.getDocInfo(uri),
        line,
        column,
      );
      if (!token) return [];
      const quoted = token.literal.match(/^`(.+)`$/);
      if (quoted) {
        // `project.dataset.`
        const idents = quoted[1].split(".");
        idents.pop();
        if (idents.length === 1) {
          const datasets =
            (await this.db.nedb.findAsync({
              project: idents[0],
              dataset: { $ne: null },
              table: null,
            })) ?? [];
          datasets.forEach((dataset) => {
            res.push({
              label: dataset.dataset!,
              kind: LSP.CompletionItemKind.Struct,
              documentation: util.convert2MarkdownItems({ kind: "dataset" }),
            });
          });
          const tables =
            (await this.db.nedb.findAsync({
              project: this.defaultProject,
              dataset: idents[0],
              table: { $ne: null },
            })) ?? [];
          tables.forEach((table) => {
            res.push({
              label: table.table!,
              kind: LSP.CompletionItemKind.Struct,
              documentation: util.convert2MarkdownItems({ kind: "table" }),
            });
          });
        } else if (idents.length === 2) {
          // TODO
          const tables =
            (await this.db.nedb.findAsync({
              project: idents[0],
              dataset: idents[1],
              table: { $ne: null },
            })) ?? [];
          tables.forEach((table) => {
            res.push({
              label: table.table!,
              kind: LSP.CompletionItemKind.Struct,
              documentation: util.convert2MarkdownItems({ kind: "table" }),
            });
          });
        }
      } else {
        // table.column | struct.field | prefix.function
        const currIndex = util.getPositionByRowColumn(
          this.getDocInfo(uri),
          line,
          column,
        );
        const currText = this.uriToText[uri];
        const prevText =
          currText.substring(0, currIndex) + currText.substring(currIndex + 1);
        let prevCsts;
        try {
          prevCsts = util.parseSQL(prevText);
        } catch {
          return [];
        }
        const nameSpaces = (await this.createNameSpaces(prevCsts)).filter(
          (ns) => {
            return util.arrangedInThisOrder(
              true,
              ns.start,
              { line: line, character: column - 1 }, // 1-character before "."
              ns.end,
            );
          },
        );
        const prevNode = util.getNodeByRowColumn(prevCsts, line, column - 1);
        if (!prevNode) return [];
        const idents = util.parseIdentifier(prevNode);
        if (idents.length === 1) {
          const ident = idents[0];
          this.getSmallestNameSpaces(
            nameSpaces.filter((ns) => ns.name && ns.name === ident),
          ).forEach((ns) => {
            res.push(
              ...ns.variables.map((v) => {
                return {
                  label: v.label,
                  kind: v.kind,
                  documentation: util.convert2MarkdownItems(v.info),
                };
              }),
            );
          });
          if (ident.toUpperCase() in notGlobalFunctions) {
            for (const f of notGlobalFunctions[ident.toUpperCase()]) {
              if (typeof f === "string") {
                res.push({
                  label: lowercaseFunction ? f.toLowerCase() : f,
                  kind: LSP.CompletionItemKind.Function,
                  documentation: util.convert2MarkdownItems({
                    kind: "function",
                  }),
                });
              } else {
                res.push({
                  label: lowercaseFunction ? f.ident.toLowerCase() : f.ident,
                  kind: LSP.CompletionItemKind.Function,
                  documentation: util.convert2MarkdownContent(f.example),
                });
              }
            }
          }
        }
        // struct
        const structs: { type: string; path: string[] }[] = [];
        nameSpaces.forEach((ns) =>
          ns.variables.forEach((v) => {
            if (ns.name && "type" in v.info) {
              structs.push(
                ...util.parseStruct(v.info.type, [ns.name, v.label]),
              );
            }
          }),
        );
        this.getSmallestNameSpaces(nameSpaces).forEach((ns) => {
          ns.variables.forEach((v) => {
            if ("type" in v.info) {
              structs.push(...util.parseStruct(v.info.type, [v.label]));
            }
          });
        });
        structs
          .filter((struct) => {
            if (struct.path.length !== idents.length + 1) return false;
            for (let i = 0; i < idents.length; i++) {
              if (struct.path[i] !== idents[i]) return false;
            }
            return true;
          })
          .forEach((struct) => {
            const label = struct.path[struct.path.length - 1];
            res.push({
              label: label,
              kind: LSP.CompletionItemKind.Field,
              documentation: util.convert2MarkdownItems({ type: struct.type }),
            });
          });
      }
    } else if (char === "`") {
      const projects =
        (await this.db.nedb.findAsync({
          dataset: null,
          table: null,
        })) ?? [];
      for (const project of projects) {
        res.push({
          label: project.project,
          kind: LSP.CompletionItemKind.Struct,
          documentation: util.convert2MarkdownItems({ kind: "project" }),
        });
      }
      const datasets =
        (await this.db.nedb.findAsync({
          project: this.defaultProject,
          dataset: { $ne: null },
          table: null,
        })) ?? [];
      for (const dataset of datasets) {
        res.push({
          label: dataset.dataset!,
          kind: LSP.CompletionItemKind.Struct,
          documentation: util.convert2MarkdownItems({ kind: "dataset" }),
        });
      }
      // TODO support default dataset (suggest table_name)
    } else if (char.match(/^\s$/)) {
      const currIndex = util.getPositionByRowColumn(
        this.getDocInfo(uri),
        line,
        column,
      );
      const currText = this.uriToText[uri];
      const newText =
        currText.substring(0, currIndex) +
        "\nident\n" +
        currText.substring(currIndex + 1);
      let newCsts;
      try {
        newCsts = util.parseSQL(newText);
      } catch {
        return [];
      }
      const namespaces = (await this.createNameSpaces(newCsts)).filter((ns) => {
        return util.arrangedInThisOrder(
          true,
          ns.start,
          { line: line + 1, character: 0 }, // position of inserted ident
          ns.end,
        );
      });
      namespaces.forEach((ns) => {
        // NOTE You may push the same name twice or more.
        if (ns.name) {
          res.push({ label: ns.name, kind: LSP.CompletionItemKind.Struct });
        }
      });
      this.getSmallestNameSpaces(namespaces).forEach((ns) => {
        ns.variables.forEach((v) => {
          res.push({
            label: v.label,
            kind: v.kind,
            documentation: util.convert2MarkdownItems(v.info),
          });
        });
      });
    } else {
      const namespaces = (
        await this.createNameSpaces(this.uriToCst[uri])
      ).filter((ns) =>
        util.arrangedInThisOrder(
          true,
          ns.start,
          { line: line, character: column },
          ns.end,
        ),
      );
      namespaces.forEach((ns) => {
        // NOTE You may push the same name twice or more.
        if (ns.name) {
          res.push({ label: ns.name, kind: LSP.CompletionItemKind.Struct });
        }
      });
      this.getSmallestNameSpaces(namespaces).forEach((ns) => {
        ns.variables.forEach((v) => {
          res.push({
            label: v.label,
            kind: v.kind,
            documentation: util.convert2MarkdownItems(v.info),
          });
        });
      });
      // functions are not suggested until you type first character
      if (node && node.node_type === "Identifier") {
        globalFunctions.forEach((f) => {
          if (typeof f === "string") {
            res.push({
              label: lowercaseFunction ? f.toLowerCase() : f,
              kind: LSP.CompletionItemKind.Function,
              documentation: util.convert2MarkdownItems({ kind: "function" }),
            });
          } else {
            res.push({
              label: lowercaseFunction ? f.ident.toLowerCase() : f.ident,
              kind: LSP.CompletionItemKind.Function,
              documentation: util.convert2MarkdownContent(f.example),
            });
          }
        });
      }
    }

    // get unique result
    return Array.from(new Set(res.map((x) => JSON.stringify(x)))).map((x) =>
      JSON.parse(x),
    );
  }

  private onDidChangeConfiguration(_: LSP.DidChangeConfigurationParams) {
    this.configurations.clear();
  }

  private async onHover(params: LSP.TextDocumentPositionParams) {
    const uri = params.textDocument.uri;
    const res = await this.provideHoverMessage(
      this.getDocInfo(uri),
      params.position,
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
    try {
      const originalText = this.uriToText[params.textDocument.uri];
      const splittedOriginalText = originalText.split("\n");

      const formattedText = await prettier.format(originalText, {
        parser: "sql-parse",
        // @ts-expect-error: locStart, locEnd are missing
        plugins: [prettierPluginBQ],
        ...config.formatting,
      });
      const splittedFormattedText = formattedText.split("\n");

      if (config.experimental.formatEachLine) {
        if (splittedOriginalText.length <= splittedFormattedText.length) {
          return splittedOriginalText.map((line, i) => {
            return {
              range: {
                start: { line: i, character: 0 },
                end: { line: i, character: line.length }, // `-1` is not needed
              },
              newText:
                i === splittedOriginalText.length - 1 // last line
                  ? splittedFormattedText.slice(i).join("\n")
                  : splittedFormattedText[i],
            };
          });
        } else {
          return splittedOriginalText
            .slice(0, splittedFormattedText.length)
            .map((line, i) => {
              return {
                range: {
                  start: { line: i, character: 0 },
                  end: {
                    line:
                      i === splittedFormattedText.length - 1 // last line
                        ? splittedOriginalText.length - 1
                        : i,
                    character:
                      i === splittedFormattedText.length - 1 // last line
                        ? splittedOriginalText[splittedOriginalText.length - 1]
                            .length
                        : line.length, // `-1` is not needed
                  },
                },
                newText: splittedFormattedText[i],
              };
            });
        }
      }
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
    } catch (e) {
      const params: LSP.ShowMessageParams = {
        message: String(e),
        type: LSP.MessageType.Error,
      };
      this.connection.sendNotification("window/showMessage", params);
      return [];
    }
  }

  private async onRequestUpdateCache(params: { uri: string }) {
    const config = await this.getConfiguration(params.uri);
    try {
      if (process.env.CI === "true") {
        await this.db.updateCacheForTest(Object.values(this.uriToText));
      } else {
        await this.db.updateCache(
          Object.values(this.uriToText),
          config.project.targetProjects,
        );
      }
      return "The cache was updated successfully.";
    } catch (e) {
      const params: LSP.ShowMessageParams = {
        message: String(e),
        type: LSP.MessageType.Error,
      };
      this.connection.sendNotification("window/showMessage", params);
    }
  }

  private async onRequestAddToCache(params: {
    uri: string;
    // 0-based position
    line: number;
    column: number;
  }) {
    const docInfo = this.getDocInfo(params.uri);
    let table = util.getNodeByRowColumn(
      docInfo.cst,
      params.line + 1,
      params.column + 1,
    );

    let parent = table?.parent?.deref();
    while (
      parent?.node_type === "DotOperator" ||
      parent?.node_type === "MultiTokenIdentifier"
    ) {
      table = parent;
      parent = parent.parent?.deref();
    }

    if (!table) {
      this.connection.sendNotification(
        "window/showMessage",
        "When exec addToCache, the cursor should be on a table name.",
      );
      return;
    }

    const fullTableName = util.getFullTableNameFromNode(table);
    const splitted = fullTableName.split(".");
    const tablename = splitted.pop();
    const dataset = splitted.pop();
    let project = splitted.pop();

    if (!tablename) {
      this.connection.sendNotification(
        "window/showMessage",
        "Something went wrong.",
      );
      return;
    }
    if (!dataset) {
      this.connection.sendNotification(
        "window/showMessage",
        `Cannot add ${tablename} to the cache because the dataset name is missing.`,
      );
      return;
    }
    if (!project) {
      project = this.defaultProject;
    }

    try {
      await this.db.addToCache(project, dataset, tablename);
      return `${project}.${dataset}.${tablename} was added to the cache successfully.`;
    } catch (e) {
      const params: LSP.ShowMessageParams = {
        message: String(e),
        type: LSP.MessageType.Error,
      };
      this.connection.sendNotification("window/showMessage", params);
    }
  }

  private async onRequestDumpCache() {
    await this.db.dumpCache();
  }

  private async provideHoverMessage(
    docInfo: util.DocumentInfo,
    position: LSP.Position,
  ) {
    const node = util.getNodeByRowColumn(
      docInfo.cst,
      position.line + 1,
      position.character + 1,
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
    const queryResults = await this.queryTableInfo(idents);
    if (queryResults.length > 0) {
      return {
        contents: util.convert2MarkdownItems(
          queryResults.map((row) => `${row.column}: ${row.data_type}`),
        ),
      };
    }

    return { contents: [] };
  }

  private updateDocumentInfo(
    change: LSP.TextDocumentChangeEvent<TextDocument>,
  ) {
    const uri = change.document.uri;
    this.uriToText[uri] = change.document.getText();
    const text = change.document.getText();
    try {
      this.uriToTokens[uri] = bq2cst.tokenize(text);
      const csts = util.parseSQL(text);
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
          !util.arrangedInThisOrder(
            true,
            { line: 0, character: 0 },
            errorPosition,
            finalCharaPosition,
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

  private async createNameSpaces(
    csts: bq2cst.UnknownNode[],
  ): Promise<NameSpace[]> {
    const res: NameSpace[] = [];
    for (const cst of csts) {
      await this.createNameSpacesFromNode(res, cst);
    }
    return res;
  }

  private async createNameSpacesFromNode(
    res: NameSpace[],
    node: bq2cst.UnknownNode,
    namespace?: NameSpace,
  ): Promise<void> {
    async function createNameSpacesFromWithClause(
      this: BQLanguageServer,
      node:
        | bq2cst.SelectStatement
        | bq2cst.GroupedStatement
        | bq2cst.SetOperator
        | bq2cst.PipeStatement
        | bq2cst.FromStatement,
    ) {
      if (node.children.with) {
        const withQueries = node.children.with.Node.children.queries.NodeVec;
        const isRecursive = !!node.children.with.Node.children.recursive;
        for (let i = 0; i < withQueries.length; i++) {
          const currWithQuery = withQueries[i];
          if (!node.range.start || !node.range.end) return;
          let start: LSP.Position;
          if (isRecursive) {
            start = node.range.start; // position of WITH
          } else {
            if (!currWithQuery.range.end) return;
            start = currWithQuery.range.end;
          }
          const ns: NameSpace = {
            start: start,
            end: node.range.end,
            name: currWithQuery.token.literal,
            variables: [],
          };
          await this.createNameSpacesFromNode(res, currWithQuery, ns);
          if (ns.variables.length > 0) res.push(ns);
        }
      }
    }

    async function createNameSpacesFromExprs(
      this: BQLanguageServer,
      node: bq2cst.SelectStatement | bq2cst.SelectPipeOperator,
      namespace: NameSpace,
    ) {
      (node.children.exprs?.NodeVec ?? []).forEach((n) => {
        const expr = n as bq2cst.Expr & bq2cst.UnknownNode;
        if (expr.children.alias) {
          namespace.variables.push({
            label: expr.children.alias.Node.token.literal,
            info: {},
            kind: LSP.CompletionItemKind.Field,
          });
        } else if (
          expr.node_type === "Asterisk" ||
          (expr.node_type === "DotOperator" &&
            expr.children.right.Node.node_type === "Asterisk")
        ) {
          const allNameSpaces = res.filter(
            (ns) =>
              ns.name &&
              (expr.node_type === "Asterisk"
                ? true
                : ns.name === expr.children.left.Node.token.literal) &&
              util.arrangedInThisOrder(
                true,
                ns.start,
                { line: node.token.line, character: node.token.column },
                ns.end,
              ),
          );
          const smallestNameSpaces = this.getSmallestNameSpaces(allNameSpaces);
          smallestNameSpaces.forEach((ns) => {
            // TODO:
            // consider EXCEPT() and REPLACE().
            // you should modify type definition before that.
            ns.variables.forEach((v) => {
              namespace.variables.push(v);
            });
          });
        } else if (
          expr.node_type === "Identifier" ||
          expr.node_type === "DotOperator"
        ) {
          const idents = util.parseIdentifier(expr);
          if (idents.length > 0) {
            namespace.variables.push({
              label: idents[idents.length - 1],
              info: {},
              kind: LSP.CompletionItemKind.Field,
            });
          }
        }
      });
    }

    function createExtendedNameSpaceFromNode(
      this: BQLanguageServer,
      node: bq2cst.UnknownNode,
      namespace: NameSpace,
      additionalVariables: string[],
      removedVariables: string[],
    ) {
      const token = node.token;
      if (!token) return;

      const allNameSpaces = res.filter((ns) =>
        util.arrangedInThisOrder(
          true,
          ns.start,
          { line: token.line, character: token.column },
          ns.end,
        ),
      );
      const smallestNameSpaces = this.getSmallestNameSpaces(allNameSpaces);
      smallestNameSpaces
        .flatMap((ns) => ns.variables)
        .forEach((v) => {
          if (removedVariables.includes(v.label)) return;
          namespace.variables.push(v);
        });
      additionalVariables.forEach((v) => {
        namespace.variables.push({
          label: v,
          info: {},
          kind: LSP.CompletionItemKind.Field,
        });
      });
    }

    if (node.node_type === "SelectStatement") {
      await createNameSpacesFromWithClause.call(this, node);
      if (node.children.where) {
        // WHERE EXISTS(SELECT ...)
        await this.createNameSpacesFromNode(res, node.children.where.Node);
      }
      for (const n of node.children.exprs.NodeVec) {
        // SELECT (SELECT ... FROM ...)
        await this.createNameSpacesFromNode(res, n);
      }
      if (node.children.from && node.range.start && node.range.end) {
        const ns: NameSpace = {
          start: {
            line: node.token.line,
            character: node.token.column,
          }, // Do not use node.range.start here!
          end: node.range.end,
          name: undefined,
          variables: [],
        };
        await this.createNameSpacesFromNode(res, node.children.from.Node, ns);
        if (ns.variables.length > 0) res.push(ns);
      }
      if (namespace) {
        await createNameSpacesFromExprs.call(this, node, namespace);
      }
    } else if (node.node_type === "SetOperator") {
      await createNameSpacesFromWithClause.call(this, node);
      await this.createNameSpacesFromNode(
        res,
        node.children.left.Node,
        namespace,
      );
      await this.createNameSpacesFromNode(res, node.children.right.Node);
    } else if (node.node_type === "GroupedStatement") {
      await createNameSpacesFromWithClause.call(this, node);
      if (node.children.alias && namespace) {
        const originalNameSpace = namespace;
        const newNameSpace: NameSpace = {
          start: originalNameSpace.start,
          end: originalNameSpace.end,
          name: node.children.alias.Node.token.literal,
          variables: [],
        };
        await this.createNameSpacesFromNode(
          res,
          node.children.stmt.Node,
          newNameSpace,
        );
        if (newNameSpace.variables.length > 0) res.push(newNameSpace);
      } else {
        await this.createNameSpacesFromNode(
          res,
          node.children.stmt.Node,
          namespace,
        );
      }
    } else if (
      node.node_type === "Identifier" ||
      node.node_type === "DotOperator" ||
      node.node_type === "MultiTokenIdentifier"
    ) {
      const additionalVariables: string[] = [];
      const removedVariables: string[] = [];
      const pivotConfig = node.children.pivot?.Node.children.config.Node;
      const unpivotConfig = node.children.unpivot?.Node.children.config.Node;
      if (pivotConfig) {
        // prefix
        const prefixes: string[] = [];
        pivotConfig.children.exprs.NodeVec.map(
          (n) => n.children.alias?.Node.token?.literal,
        ).forEach((alias) => {
          if (alias) prefixes.push(alias);
        });

        // suffix
        // https://cloud.google.com/bigquery/docs/reference/standard-sql/query-syntax#rules_pivot_column
        const group = pivotConfig.children.in.Node.children.group.Node;
        const suffixes: string[] = [];
        if (group.node_type === "GroupedExprs") {
          group.children.exprs?.NodeVec.map(
            (n: bq2cst.Expr & bq2cst.UnknownNode) => {
              if (n.children.alias) {
                suffixes.push(n.children.alias.Node.token.literal);
              } else {
                // TODO: unary operator
                switch (n.node_type) {
                  case "NullLiteral":
                  case "BooleanLiteral": {
                    suffixes.push(n.token.literal.toUpperCase());
                    break;
                  }
                  case "NumericLiteral": {
                    suffixes.push(n.token.literal);
                    break;
                  }
                  case "UnaryOperator": {
                    // TODO: support NUMERIC, BIGNUMERIC, DATE, RAW string literal
                    break;
                  }
                  case "StringLiteral": {
                    suffixes.push(util.stripStringLiteral(n.token.literal));
                    break;
                  }
                  // TODO: ENUM, STRUCT
                }
              }
            },
          );
        }

        if (0 < prefixes.length) {
          for (const p of prefixes) {
            for (const s of suffixes) {
              additionalVariables.push(
                util.quoteIfComplexIdentifier(`${p}_${s}`),
              );
            }
          }
        } else {
          for (const s of suffixes) {
            additionalVariables.push(s);
          }
        }

        const expr = pivotConfig.children.for.Node.children.expr.Node;
        if (expr.node_type === "Identifier") {
          removedVariables.push(expr.token.literal);
        }
      } else if (unpivotConfig) {
        const valueExpr = unpivotConfig.children.expr.Node;
        if (valueExpr.node_type === "Identifier") {
          additionalVariables.push(valueExpr.token.literal);
        } else if (valueExpr.node_type === "GroupedExprs") {
          const exprs = valueExpr.children.exprs?.NodeVec || [];
          exprs.forEach((n) => {
            if (n.node_type !== "Identifier") return;
            additionalVariables.push(n.token.literal);
          });
        }

        const nameExpr = unpivotConfig.children.for.Node.children.expr.Node;
        if (nameExpr.node_type === "Identifier") {
          additionalVariables.push(nameExpr.token.literal);
        }

        const inExpr = unpivotConfig.children.in.Node.children.group.Node;
        if (inExpr.node_type === "GroupedExprs") {
          const exprs = inExpr.children.exprs?.NodeVec || [];
          exprs.forEach((n) => {
            if (n.node_type === "Identifier") {
              removedVariables.push(n.token.literal);
            } else if (n.node_type === "GroupedExprs") {
              // NOTE: node type would be changed later
              const exprs = n.children.exprs?.NodeVec || [];
              exprs.forEach((n) => {
                if (n.node_type !== "Identifier") return;
                removedVariables.push(n.token.literal);
              });
            }
          });
        }
      }

      if (namespace) {
        const idents = util.parseIdentifier(node);
        const queryResults = await this.queryTableInfo(idents);
        let name = node.children.alias
          ? node.children.alias.Node.token.literal
          : idents[idents.length - 1];
        if (node.children.pivot) {
          name =
            node.children.pivot.Node.children.alias?.Node.token?.literal ||
            name;
        } else if (node.children.unpivot) {
          name =
            node.children.unpivot.Node.children.alias?.Node.token?.literal ||
            name;
        }
        const ns: NameSpace = {
          start: namespace.start,
          end: namespace.end,
          name: name,
          variables: [],
        };

        // check with clause
        if (idents.length === 1) {
          const ident = idents[0];
          const namespaces = this.getSmallestNameSpaces(
            res.filter(
              (ns) =>
                ns.name &&
                ns.name === ident &&
                util.arrangedInThisOrder(
                  true,
                  ns.start,
                  { line: node.token.line, character: node.token.column },
                  ns.end,
                ),
            ),
          );
          namespaces.forEach((namespace) => {
            namespace.variables.forEach((v) => {
              if (removedVariables.includes(v.label)) return;

              ns.variables.push(v);
            });
          });
        }

        queryResults.forEach((row) => {
          if (removedVariables.includes(row.column)) return;

          ns.variables.push({
            label: row.column,
            info: { type: row.data_type },
            kind: LSP.CompletionItemKind.Field,
          });
        });

        additionalVariables.forEach((v) => {
          ns.variables.push({
            label: v,
            info: {},
            kind: LSP.CompletionItemKind.Field,
          });
        });
        if (ns.variables.length > 0) res.push(ns);
      }
    } else if (node.node_type === "CallingUnnest") {
      if (namespace && node.children.alias) {
        namespace.variables.push({
          label: node.children.alias.Node.token.literal,
          info: {},
          kind: LSP.CompletionItemKind.Field,
        });
      }
    } else if (node.node_type === "PipeStatement") {
      await createNameSpacesFromWithClause.call(this, node);

      const operators: bq2cst.UnknownNode[] = [];
      let curr: bq2cst.UnknownNode = node;
      while (curr.node_type === "PipeStatement") {
        operators.unshift(curr.children.right.Node);
        curr = curr.children.left.Node;
      }
      operators.unshift(curr);
      for (let i = 0; i < operators.length; i++) {
        const curr = operators[i];
        const next = operators[i + 1];
        if (!next?.range.start || !next?.range.end) continue;

        const ns: NameSpace = {
          start: next.range.start,
          end: next.range.end,
          name: undefined,
          variables: [],
        };
        await this.createNameSpacesFromNode(res, curr, ns);

        if (ns.variables.length === 0) continue;
        res.push(ns);
      }
    } else if (node.node_type === "FromStatement") {
      if (namespace) {
        await this.createNameSpacesFromNode(
          res,
          node.children.expr.Node,
          namespace,
        );
      } else {
        // when used without PipeStatement
        await createNameSpacesFromWithClause.call(this, node);
      }
    } else if (node.node_type === "SelectPipeOperator") {
      if (!namespace) return;
      await createNameSpacesFromExprs.call(this, node, namespace);
    } else if (
      (node.node_type === "BasePipeOperator" &&
        ["SET", "WHERE", "ORDER"].includes(node.token.literal.toUpperCase())) ||
      (node.node_type === "Symbol" &&
        node.token.literal.toUpperCase() === "DISTINCT") ||
      node.node_type === "LimitPipeOperator" ||
      node.node_type === "TableSamplePipeOperator" ||
      node.node_type === "UnionPipeOperator"
    ) {
      if (!namespace) return;
      createExtendedNameSpaceFromNode.call(this, node, namespace, [], []);
    } else if (
      node.node_type === "BasePipeOperator" &&
      node.token.literal.toUpperCase() === "DROP"
    ) {
      if (!namespace) return;
      const exprs = (node.children.exprs?.NodeVec ?? [])
        .map((n) => {
          if (n.node_type !== "Identifier") return null;
          return n.token.literal;
        })
        .filter((literal) => literal) as string[];
      createExtendedNameSpaceFromNode.call(this, node, namespace, [], exprs);
    } else if (
      node.node_type === "BasePipeOperator" &&
      node.token.literal.toUpperCase() === "EXTEND"
    ) {
      if (!namespace) return;
      const exprs = (node.children.exprs?.NodeVec ?? [])
        .map((n) => {
          if ("alias" in n.children) {
            return n.children.alias?.Node.token?.literal;
          } else {
            return null;
          }
        })
        .filter((literal) => literal) as string[];
      createExtendedNameSpaceFromNode.call(this, node, namespace, exprs, []);
    } else {
      for (const child of util.getAllChildren(node)) {
        await this.createNameSpacesFromNode(res, child, namespace);
      }
    }
  }

  private async queryTableInfo(idents: string[]): Promise<QueryResult[]> {
    function replaceTableSuffix(s: string) {
      return s.replace(/([^0-9])[0-9]{8,}$/, "$1*");
    }

    if (idents.length === 1) {
      // TODO support default dataset
      return [];
    } else if (idents.length === 2) {
      const table = await this.db.nedb.findOneAsync({
        project: this.defaultProject,
        dataset: idents[0],
        table: replaceTableSuffix(idents[1]),
      });
      const queryResults: QueryResult[] =
        table?.columns?.map((col) => ({
          column: col.column,
          data_type: col.data_type,
        })) || [];

      return queryResults;
    } else if (idents.length === 3) {
      const table = await this.db.nedb.findOneAsync({
        project: idents[0],
        dataset: idents[1],
        table: replaceTableSuffix(idents[2]),
      });
      const queryResults: QueryResult[] =
        table?.columns?.map((col) => ({
          column: col.column,
          data_type: col.data_type,
        })) || [];
      return queryResults;
    } else {
      return [];
    }
  }
}
