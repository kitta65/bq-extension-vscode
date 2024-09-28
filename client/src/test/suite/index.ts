import * as path from "path";
import * as Mocha from "mocha";
import { globSync } from "glob";
import * as vscode from "vscode";
import * as util from "./util";

// NOTE If the function is not named `run`, you'll get an error.
export function run() {
  const mocha = new Mocha({ ui: "bdd", color: true });
  mocha.timeout(0);
  mocha.globalSetup(globalSetup);
  const testsRoot = __dirname;
  globSync("**.test.js", { cwd: testsRoot }).forEach((f) => {
    mocha.addFile(path.resolve(testsRoot, f));
  });

  mocha.run((failures) => {
    if (0 < failures) {
      throw `${failures} tests failed.`;
    }
  });
}

async function globalSetup() {
  console.log("Start initializing the extension");
  const ext = vscode.extensions.getExtension("dr666m1.bq-extension-vscode")!;
  await ext.activate();
  await util.createTextDocument("cache.bq");
  await util.insert(
    "cache.bq",
    new vscode.Position(0, 0),
    `
SELECT * FROM \`${util.project}.bq_extension_vscode_test.t\`;
SELECT * FROM \`${util.project}.bq_extension_vscode_test_asia.v\`;`,
  );
  await vscode.commands.executeCommand("bqExtensionVSCode.clearCache");
  await vscode.commands.executeCommand("bqExtensionVSCode.updateCache");
  await util.deleteTextDocument("cache.bq");
  console.log("Finish initializing the extension");
}
