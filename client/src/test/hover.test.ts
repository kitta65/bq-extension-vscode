import * as assert from "assert";
import * as vscode from "vscode";
import * as util from "./util";

const filename = "hover.bq";
type Hover = {
  contents: { value: string }[];
};

describe("Hover", function () {
  beforeEach(async function () {
    await util.createTextDocument(filename);
  });
  afterEach(async function () {
    await util.deleteTextDocument(filename);
  });
  it("minimum", async function () {
    const sql = `SELECT * FROM \`${util.project}.bq_extension_vscode_test.t\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const hover: Hover = (
      await vscode.commands.executeCommand(
        "vscode.executeHoverProvider",
        util.getDocUri(filename),
        new vscode.Position(0, sql.length)
      )
    )[0];
    const items = hover.contents.map((x) => x.value);
    assert.ok(items.some((x) => x === "str: STRING"));
  });
  it("table suffix (asterisk)", async function () {
    const sql = `SELECT * FROM \`${util.project}.bq_extension_vscode_test.u_*\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const hover: Hover = (
      await vscode.commands.executeCommand(
        "vscode.executeHoverProvider",
        util.getDocUri(filename),
        new vscode.Position(0, sql.length)
      )
    )[0];
    const items = hover.contents.map((x) => x.value);
    assert.ok(items.some((x) => x === "str: STRING"));
  });
  it("table suffix (full)", async function () {
    const sql = `SELECT * FROM \`${util.project}.bq_extension_vscode_test.u_20210101\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const hover: Hover = (
      await vscode.commands.executeCommand(
        "vscode.executeHoverProvider",
        util.getDocUri(filename),
        new vscode.Position(0, sql.length)
      )
    )[0];
    const items = hover.contents.map((x) => x.value);
    assert.ok(items.some((x) => x === "str: STRING"));
  });
});
