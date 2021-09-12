import * as assert from "assert";
import * as vscode from "vscode";
import * as util from "./util";

/**NOTE
 * The position of the diagnostic is not tested here
 * because it depends on the message from BigQuery (or `@dr666m1/bq2cst`).
 */

describe("Diagnostics", function () {
  beforeEach(async function () {
    await util.createTextDocument("diagnostics.bq");
  });
  afterEach(async function () {
    await util.deleteTextDocument("diagnostics.bq");
  });
  it("dry-run-success", async function () {
    await util.insert("diagnostics.bq", new vscode.Position(0, 0), "SELECT 1;");
    await vscode.commands.executeCommand("bqExtensionVSCode.dryRun")
    const diagnostics = vscode.languages.getDiagnostics(util.getDocUri("diagnostics.bq"))
    assert.strictEqual(diagnostics.length, 0)
  });
  it("dry-run-fail", async function () {
    await util.insert("diagnostics.bq", new vscode.Position(0, 0), "SELECT 1;;");
    await vscode.commands.executeCommand("bqExtensionVSCode.dryRun")
    const diagnostics = vscode.languages.getDiagnostics(util.getDocUri("diagnostics.bq"))
    assert.strictEqual(diagnostics.length, 1)
  });
  it("bq2cst-success", async function () {
    await util.insert("diagnostics.bq", new vscode.Position(0, 0), "SELECT ''");
    await util.sleep(1 * 1000) // wait for processing
    const diagnostics = vscode.languages.getDiagnostics(util.getDocUri("diagnostics.bq"))
    assert.strictEqual(diagnostics.length, 0)
  });
  it("bq2cst-fail", async function () {
    await util.insert("diagnostics.bq", new vscode.Position(0, 0), "SELECT '");
    await util.sleep(1 * 1000) // wait for processing
    const diagnostics = vscode.languages.getDiagnostics(util.getDocUri("diagnostics.bq"))
    assert.strictEqual(diagnostics.length, 1)
  });
});
