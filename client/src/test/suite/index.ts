import * as path from "path";
import * as Mocha from "mocha";
import * as glob from "glob";
import * as vscode from "vscode";
import * as util from "./util";
import { execSync } from "child_process";

// NOTE If the function is not named `run`, you'll get an error.
export function run(): Promise<void> {
  const mocha = new Mocha({ ui: "bdd", color: true });
  mocha.timeout(0);
  mocha.globalSetup(globalSetup);
  const testsRoot = __dirname;
  return new Promise<void>((resolve, reject) => {
    glob("**.test.js", { cwd: testsRoot }, (err, files) => {
      if (err) {
        return reject(err);
      }
      files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));
      try {
        mocha.run((failures) => {
          if (0 < failures) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      } catch (err) {
        console.error(err);
        reject(err);
      }
    });
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
SELECT * FROM \`${util.project}.bq_extension_vscode_test_asia.v\`;`
  );
  await vscode.commands.executeCommand("bqExtensionVSCode.clearCache");
  // sqlite file name is defined in other file
  execSync(
    `sqlite3 ${process.env.HOME}/.bq_extension_vscode/*.sqlite < initialize.sql`
  );
  await util.deleteTextDocument("cache.bq");
  console.log("Finish initializing the extension");
}
