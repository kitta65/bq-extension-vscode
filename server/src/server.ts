import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  TextDocumentSyncKind,
  InitializeResult,
} from "vscode-languageserver/node";
import { BigQuery } from "@google-cloud/bigquery";
import { TextDocument } from "vscode-languageserver-textdocument";
import { tokenize } from "@dr666m1/bq2cst";

const connection = createConnection(ProposedFeatures.all);
const bqClient = new BigQuery();
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize(() => {
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
    },
  };
  return result;
});

documents.onDidSave((change) => {
  dryRun(change.document);
});

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
    connection.sendNotification("dryRun", msg);
  } catch (e) {
    // TODO detect `not log in` error
    const msg = e.message; // Syntax error: Unexpected end of script at [1:7]
    const matchResult = msg.match(/\[([0-9]+):([0-9]+)\]/);
    if (matchResult) {
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
      connection.sendDiagnostics({
        uri: textDocument.uri,
        diagnostics: [diagnostic],
      });
    }
    connection.sendNotification("dryRun", "ERROR");
  }
}

documents.listen(connection);
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
