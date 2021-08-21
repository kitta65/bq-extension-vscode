import * as path from "path";
import * as vscode from "vscode";

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

  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "index.js")
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
    documentSelector: [{ scheme: "file", language: "bigquery" }],
  };
  client = new LanguageClient(
    "bqExtensionVSCode",
    "BQ Extension VSCode",
    serverOptions,
    clientOptions
  );
  const channel = client.outputChannel;
  client.onReady().then(() => {
    client.onNotification("bq/dryRun", (params) => {
      statusBarItem.text = params.totalBytesProcessed;
      statusBarItem.show();
    });
    client.onNotification("window/logMessage", (params) => {
      channel.appendLine(params.message);
    });
  });
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
