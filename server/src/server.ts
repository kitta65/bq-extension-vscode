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

documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

documents.onDidSave((change) => {
  dryRun(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const text = textDocument.getText();
  const pattern = /\b[A-Z]{2,}\b/g;
  let m: RegExpExecArray | null;

  let problems = 0;
  const diagnostics: Diagnostic[] = [];
  while ((m = pattern.exec(text)) && problems < 100) {
    problems++;
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Warning,
      range: {
        start: textDocument.positionAt(m.index),
        end: textDocument.positionAt(m.index + m[0].length),
      },
      message: `${m[0]} is all uppercase.`,
    };
    diagnostics.push(diagnostic);
  }
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

async function dryRun(textDocument: TextDocument): Promise<void> {
  const text = textDocument.getText();
  let diagnostic: Diagnostic;
  try {
    // NOTE bqClient.createQueryJob()[1].statistics.totalBytesProcessed may be useful
    const [_, apiResponse] = await bqClient.createQueryJob({
      query: text,
      dryRun: true,
    });
    if (apiResponse.statistics && apiResponse.statistics.totalBytesProcessed) {
      diagnostic = {
        severity: DiagnosticSeverity.Information,
        range: {
          start: textDocument.positionAt(0),
          end: textDocument.positionAt(1),
        },
        message: apiResponse.statistics.totalBytesProcessed,
      };
    } else {
      diagnostic = {
        severity: DiagnosticSeverity.Error,
        range: {
          start: textDocument.positionAt(0),
          end: textDocument.positionAt(1),
        },
        message: "Could not receive information about total bytes processed.",
      };
    }
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
  }
  connection.sendDiagnostics({
    uri: textDocument.uri,
    diagnostics: [diagnostic],
  });
}

documents.listen(connection);
connection.listen();
