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
    connection.sendNotification("dryRun", msg);
  } catch (e) {
    // TODO detect `not log in` error
    diagnostic = {
      severity: DiagnosticSeverity.Information,
      range: {
        start: textDocument.positionAt(0),
        end: textDocument.positionAt(1),
      },
      message: e.message, // Syntax error: Unexpected end of script at [1:7]
    };
    connection.sendNotification("dryRun", "ERROR");
    connection.sendDiagnostics({
      uri: textDocument.uri,
      diagnostics: [diagnostic],
    });
  }
}

documents.listen(connection);
connection.listen();

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes}B`;
  } else if (bytes < 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(1)}KB`;
  } else if (bytes < 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(1)}MB`;
  } else if (bytes < 1024 ** 4) {
    return `${(bytes / 1024 ** 4).toFixed(1)}GB`;
  } else if (bytes < 1024 ** 5) {
    return `${(bytes / 1024 ** 5).toFixed(1)}TB`;
  } else {
    return `${(bytes / 1024 ** 6).toFixed(1)}PB`;
  }
}
