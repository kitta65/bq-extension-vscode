import * as LSP from "vscode-languageserver/node";
import { BQLanguageServer } from "./server";

const connection = LSP.createConnection(LSP.ProposedFeatures.all);

connection.onInitialize(async (params: LSP.InitializeParams) => {
  const server = await BQLanguageServer.initialize(connection, params);
  server.register();
  return server.capabilities;
});

connection.listen();
