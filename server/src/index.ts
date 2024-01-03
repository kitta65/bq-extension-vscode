import * as LSP from "vscode-languageserver/node";
import { BQLanguageServer } from "./server";
import { CacheDB } from "./database";

const connection = LSP.createConnection(LSP.ProposedFeatures.all);
const clientCapabilities: Record<string, boolean> = {
  hasConfigurationCapability: false,
};

connection.onInitialize(async (params: LSP.InitializeParams) => {
  const capabilities = params.capabilities;
  clientCapabilities.hasConfigurationCapability = !!(
    capabilities.workspace && capabilities.workspace.configuration
  );

  const db = await CacheDB.initialize(
    // file name will be updated on every breaking change
    `${process.env.HOME}/.bq_extension_vscode/cache_00_00_44.sqlite`
  );
  // in the case that the client does not request shutdown
  process.on("SIGTERM", () => {
    db.close();
  });

  const server = await BQLanguageServer.initialize(
    connection,
    db,
    clientCapabilities
  );
  server.register();
  return server.capabilities;
});

connection.onInitialized((_) => {
  if (clientCapabilities.hasConfigurationCapability) {
    connection.client.register(
      LSP.DidChangeConfigurationNotification.type,
      undefined
    );
  }
});

connection.listen();
