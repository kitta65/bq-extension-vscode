import * as assert from "assert";
import * as vscode from "vscode";
import * as util from "./util";

describe("Diagnostics", function () {
  beforeEach(async function () {
    await util.createTextDocument("diagnostics.bq");
  });
  afterEach(async function () {
    await util.deleteTextDocument("diagnostics.bq");
  });
  it("success", async function () {
    await util.insert("diagnostics.bq", new vscode.Position(0, 0), "SELECT 1;");
    await vscode.commands.executeCommand("bqExtensionVSCode.dryRun")
    const diagnostics = vscode.languages.getDiagnostics(util.getDocUri("diagnostics.bq"))
    assert.strictEqual(diagnostics.length, 0)
  });
  it("fail", async function () {
    await util.insert("diagnostics.bq", new vscode.Position(0, 0), "SELECT 1;;");
    await vscode.commands.executeCommand("bqExtensionVSCode.dryRun")
    const diagnostics = vscode.languages.getDiagnostics(util.getDocUri("diagnostics.bq"))
    assert.strictEqual(diagnostics.length, 1)
  });
});
