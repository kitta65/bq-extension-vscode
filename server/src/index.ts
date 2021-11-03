import * as LSP from "vscode-languageserver/node";
import { BQLanguageServer } from "./server";
import { CacheDB } from "./database";

const connection = LSP.createConnection(LSP.ProposedFeatures.all);

connection.onInitialize(async (params: LSP.InitializeParams) => {
  const db = await CacheDB.initialize(
    `${process.env.HOME}/.bq_extension_vscode/cache.sqlite`
  );
  // in the case that the client does not request shutdown
  process.on("SIGTERM", () => {
    db.close();
  });

  const server = await BQLanguageServer.initialize(connection, db, params);
  server.register();
  return server.capabilities;
});

connection.listen();
