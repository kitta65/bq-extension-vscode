import * as path from "path";
import * as vscode from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  ResponseMessage,
} from "vscode-languageclient/node";

let client: LanguageClient;

export async function activate(context: vscode.ExtensionContext) {
  const statusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(
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
  const commands = [clearCache, updateCache, dryRun];
  client.start();
  await client.onReady().then(() => {
    client.onNotification("bq/totalBytesProcessed", (params) => {
      statusBarItem.text = params.totalBytesProcessed;
      statusBarItem.show();
    });
    client.onNotification("window/logMessage", (params) => {
      channel.appendLine(params.message);
    });
    // NOTE Some commands should not be executed before the client is ready.
    commands.forEach((c) => {
      const disposable = vscode.commands.registerCommand(
        `bqExtensionVSCode.${c.name}`,
        c.bind(client)
      );
      context.subscriptions.push(disposable);
    });
  });
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

async function clearCache(this: LanguageClient): Promise<void> {
  const response = (await this.sendRequest("bq/clearCache")) as ResponseMessage;
  handleResponse(response);
}

async function dryRun(this: LanguageClient): Promise<void> {
  const uri = vscode.window.activeTextEditor.document.uri;
  const response = (await this.sendRequest("bq/dryRun", {
    uri: uri.toString(),
  })) as ResponseMessage;
  handleResponse(response);
}

async function updateCache(this: LanguageClient): Promise<void> {
  const response = (await this.sendRequest(
    "bq/updateCache"
  )) as ResponseMessage;
  handleResponse(response);
}

function handleResponse(response: ResponseMessage): void {
  const err = response.error;
  if (err) {
    vscode.window.showInformationMessage(`${err.code}: ${err.message}`);
  } else if (response.result) {
    vscode.window.showInformationMessage(`${response.result}`);
  } else {
    vscode.window.showInformationMessage("done!");
  }
}
