import * as path from "path";
import * as vscode from "vscode";
import * as prettier from "prettier";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      { scheme: "file", language: "sql" },
      new BQDocumentFormatter()
    )
  );

  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js")
  );
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "sql" }],
  };
  client = new LanguageClient(
    "bqExtensionVSCode",
    "BQ Extension VSCode",
    serverOptions,
    clientOptions
  );
  const channel = client.outputChannel
  client.onReady().then(() => {
    client.onNotification("bq/dryRun", (params) => {
      statusBarItem.text = params.totalBytesProcessed;
      statusBarItem.show();
    });
    client.onNotification("window/logMessage", (params) => {
      channel.appendLine(params.message)
    })
  });
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

class BQDocumentFormatter implements vscode.DocumentFormattingEditProvider {
  public provideDocumentFormattingEdits(
    document: vscode.TextDocument
  ): vscode.TextEdit[] {
    const original_text = document.getText();
    const formatted_text = prettier.format(original_text, {
      // NOTE you do not have to specify `plugins`
      parser: "sql-parse",
    });
    return [
      vscode.TextEdit.replace(
        document.validateRange(
          new vscode.Range(
            0,
            0,
            document.lineCount, // NOTE intentionally missing `-1`
            0
          )
        ),
        formatted_text
      ),
    ];
  }
}
