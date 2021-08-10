import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  TextDocumentSyncKind,
  InitializeResult,
  Position,
} from "vscode-languageserver/node";
import { BigQuery } from "@google-cloud/bigquery";
import { TextDocument } from "vscode-languageserver-textdocument";
import { tokenize, parse, UnknownNode } from "@dr666m1/bq2cst";
import * as fs from "fs";
import * as https from "https";
import { exec } from "child_process";

const connection = createConnection(ProposedFeatures.all);
const bqClient = new BigQuery();
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
const cacheDir = `${process.env.HOME}/.bq_extension_vscode/cache/`;
const cst: Record<string, UnknownNode[]> = {};
type TableRecord = {
  project: string;
  dataset: string;
  table: string;
  column: string;
  data_type: string;
};
connection.onInitialize(() => {
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
    },
  };
  return result;
});

documents.onDidSave((change) => {
  dryRun(change.document);
  makeCache(change.document);
});

documents.onDidChangeContent((change) => {
  const uri = change.document.uri;
  try {
    cst[uri] = parse(change.document.getText());
  } catch (err) {
    //
  }
});

documents.onDidOpen((change) => {
  makeCache(change.document);
});

function log(message: string) {
  connection.sendNotification("window/logMessage", {
    message: message,
  });
}

async function dryRun(textDocument: TextDocument): Promise<void> {
  const text = textDocument.getText();
  let diagnostic: Diagnostic;
  try {
    let msg;
    const [_, apiResponse] = await bqClient.createQueryJob({
      query: text,
      dryRun: true,
    });
    if (apiResponse.statistics && apiResponse.statistics.totalBytesProcessed) {
      msg = formatBytes(Number(apiResponse.statistics.totalBytesProcessed));
    } else {
      msg = "???B";
    }
    connection.sendDiagnostics({
      uri: textDocument.uri,
      diagnostics: [],
    }); // clear old diagnostics
    connection.sendNotification("bq/dryRun", { totalBytesProcessed: msg });
  } catch (e) {
    const msg = e.message;
    const matchResult = msg.match(/\[([0-9]+):([0-9]+)\]/);
    if (matchResult) {
      // in the case of message like below
      // Syntax error: Unexpected end of script at [1:7]
      const token = getTokenByRowColumn(
        text,
        Number(matchResult[1]),
        Number(matchResult[2])
      );
      const position = getPositionByRowColumn(text, token.line, token.column);
      diagnostic = {
        severity: DiagnosticSeverity.Error,
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
        severity: DiagnosticSeverity.Error,
        range: {
          start: textDocument.positionAt(0),
          end: textDocument.positionAt(text.length),
        },
        message: msg,
      };
    }
    connection.sendDiagnostics({
      uri: textDocument.uri,
      diagnostics: [diagnostic],
    });
    connection.sendNotification("bq/dryRun", { totalBytesProcessed: "ERROR" });
  }
}

documents.listen(connection);
connection.onHover(async (params) => {
  const uri = params.textDocument.uri;
  const res = await provideHoverMessage(cst[uri], params.position);
  return res;
});
connection.listen();

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes}B`;
  } else if (bytes < 1024 ** 2) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  } else if (bytes < 1024 ** 3) {
    return `${(bytes / 1024 ** 2).toFixed(1)}MB`;
  } else if (bytes < 1024 ** 4) {
    return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
  } else if (bytes < 1024 ** 5) {
    return `${(bytes / 1024 ** 4).toFixed(1)}TB`;
  } else {
    return `${(bytes / 1024 ** 5).toFixed(1)}PB`;
  }
}

function getPositionByRowColumn(text: string, row: number, column: number) {
  const rowLengthArr = text.split("\n").map((x) => x.length + 1); // add length of "\n"
  const position =
    rowLengthArr.slice(0, row - 1).reduce((x, y) => x + y, 0) + column;
  return position - 1;
}

function getTokenByRowColumn(text: string, row: number, column: number) {
  const errorPosition = getPositionByRowColumn(text, row, column);
  const tokens = tokenize(text);
  let prevTokenPosition = 0;
  for (const token of tokens) {
    const currTokenPosition = getPositionByRowColumn(
      text,
      token.line,
      token.column
    );
    if (
      prevTokenPosition <= errorPosition &&
      errorPosition <= currTokenPosition
    ) {
      return token;
    }
    prevTokenPosition = currTokenPosition;
  }
  return tokens[tokens.length - 1];
}

async function makeCache(textDocument: TextDocument): Promise<void> {
  // TODO prevent collision
  const text = textDocument.getText();
  fs.mkdir(cacheDir, { recursive: true }, (err) => {
    if (err) log(err.toString());
  });

  // cache projects
  const projects = await getAvailableProjects();
  fs.writeFile(cacheDir + "projects.json", JSON.stringify(projects), (err) => {
    if (err) log(err.toString());
  });

  // cache datasets
  let datasets = [];
  for (const proj of projects) {
    try {
      const [job] = await bqClient.createQueryJob({
        query: `
          SELECT
            catalog_name AS project,
            schema_name AS dataset,
          FROM \`${proj}\`.INFORMATION_SCHEMA.SCHEMATA
          LIMIT 10000;`,
      });
      const [rows] = await job.getQueryResults();
      datasets.push(rows);
    } catch (err) {
      log(err.toString());
    }
  }
  datasets = datasets.reduce((x, y) => x.concat(y), []);
  fs.writeFile(`${cacheDir}/datasets.json`, JSON.stringify(datasets), (err) => {
    if (err) log(err.toString());
  });

  // cache tables & columns
  // TODO handle _TABLE_SUFFIX
  const tokens = fineTokenize(text);
  let tables = [];
  try {
    for (const dataset of datasets) {
      if (!tokens.includes(dataset.dataset)) continue;
      const [job] = await bqClient.createQueryJob({
        query: `
          SELECT
            table_catalog AS project,
            table_schema AS dataset,
            table_name AS table,
            column_name AS column,
            data_type,
          FROM \`${dataset.dataset}\`.INFORMATION_SCHEMA.COLUMNS
          LIMIT 10000;`,
      });
      const [rows] = await job.getQueryResults();
      tables.push(rows);
    }
    tables = tables.reduce((x, y) => x.concat(y), []);
    fs.writeFile(`${cacheDir}/tables.json`, JSON.stringify(tables), (err) => {
      if (err) err.toString();
    });
  } catch (err) {
    log(err.toString());
  }
}

function fineTokenize(text: string) {
  const tokens = tokenize(text);
  const res: string[] = [];
  for (const t of tokens) {
    const matchingResult = t.literal.match(/^`(.+)`$/);
    if (matchingResult) {
      matchingResult[1].split(".").forEach((x) => res.push(x));
    } else {
      res.push(t.literal);
    }
  }
  return res;
}

async function getAvailableProjects() {
  const token = await getToken();
  return new Promise<string[]>((resolve) => {
    https
      .request(
        "https://bigquery.googleapis.com/bigquery/v2/projects",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        (res) => {
          res.on("data", (chunk) => {
            const json: {
              projects: { projectReference: { projectId: string } }[];
            } = JSON.parse("" + chunk);
            const projects = json.projects.map((x) => {
              return x.projectReference.projectId;
            });
            resolve(projects);
          });
        }
      )
      .end();
  });
}

async function getToken() {
  return new Promise<string>((resolve) => {
    exec("gcloud auth application-default print-access-token", (_, stdout) => {
      resolve(stdout.trim()); // remove "\n"
    });
  });
}

async function provideHoverMessage(cst: UnknownNode[], position: Position) {
  const columns: string[] = [];
  async function checkCache(
    node: UnknownNode,
    parent?: UnknownNode,
    _?: UnknownNode // grandParent
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
      if (positionBetween(position, startPosition, endPosition)) {
        log(literal);
        // TODO check parent and grandParent
        if (node.node_type === "Identifier") {
          const matchingResult = literal.match(/^`(.+)`$/);
          if (matchingResult) {
            const splittedIdentifier = matchingResult[1].split(".");
            const table = splittedIdentifier[splittedIdentifier.length - 1];
            const tables = await getMatchTables(table);
            tables.forEach((x: TableRecord) =>
              columns.push(`${x.column}: ${x.data_type}`)
            );
          } else {
            const tables = await getMatchTables(literal);
            tables.forEach((x: TableRecord) =>
              columns.push(`${x.column}: ${x.data_type}`)
            );
          }
        }
      } else {
        for (const [_, child] of Object.entries(node.children)) {
          if (child && "Node" in child) {
            await checkCache(child.Node as UnknownNode, node, parent);
          } else if (child && "NodeVec" in child) {
            for (const n in child.NodeVec) {
              await checkCache(n as UnknownNode, node, parent);
            }
          }
        }
      }
    }
  }
  // TODO parallelize
  for (const c of cst) {
    await checkCache(c);
  }
  return { contents: columns };
}

function positionBetween(position: Position, start: Position, end: Position) {
  if (position.line < start.line) return false;
  if (position.line === start.line && position.character < start.character)
    return false;
  if (end.line < position.line) return false;
  if (position.line === end.line && end.character < position.character)
    return false;
  return true;
}

async function getMatchTables(ident: string) {
  const jsonString = await fs.promises.readFile(
    `${cacheDir}/tables.json`,
    "utf8"
  );
  const jsonObj = JSON.parse(jsonString);
  return jsonObj.filter((x: TableRecord) => x.table === ident);
}
