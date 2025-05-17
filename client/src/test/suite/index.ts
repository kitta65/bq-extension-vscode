import * as path from "path";
import * as Mocha from "mocha";
import { globSync } from "glob";
import * as vscode from "vscode";
import * as util from "./util";

// NOTE If the function is not named `run`, you'll get an error.
export function run(): Promise<void> {
  const mocha = new Mocha({ ui: "bdd", color: true });
  mocha.timeout(0);
  mocha.globalSetup(globalSetup);
  const testsRoot = __dirname;
  globSync("**.test.js", { cwd: testsRoot }).forEach((f) => {
    mocha.addFile(path.resolve(testsRoot, f));
  });

  return new Promise<void>((resolve, reject) => {
    mocha.run((failures) => {
      if (0 < failures) {
        reject(new Error(`${failures} tests failed.`));
      } else {
        resolve();
      }
    });
  });
}

async function globalSetup() {
  console.log("Start initializing the extension");
  const ext = vscode.extensions.getExtension(
    "kitta65.googlesql-extension-vscode",
  )!;
  await ext.activate();
  const projectId = await util.getProjectId();
  await util.insert(
    "cache.bq",
    new vscode.Position(0, 0),
    `
SELECT * FROM \`${projectId}.bq_extension_vscode_test.t\`;
SELECT * FROM \`${projectId}.bq_extension_vscode_test_asia.v\`;`,
  );
  await vscode.commands.executeCommand("bqExtensionVSCode.clearCache");
  await vscode.commands.executeCommand("bqExtensionVSCode.updateCache");
  await util.deleteTextDocument("cache.bq");
  console.log("Finish initializing the extension");
}
