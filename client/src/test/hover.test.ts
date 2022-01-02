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
  it("t", async function () {
    const sql = `SELECT * FROM \`${util.project}.bq_extension_vscode_test.t\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const hover: Hover = (
      await vscode.commands.executeCommand(
        "vscode.executeHoverProvider",
        util.getDocUri(filename),
        new vscode.Position(0, sql.length - 1)
      )
    )[0];
    const items = hover.contents.map((x) => x.value);
    assert.ok(items.some((x) => x === "str: STRING"));
  });
  it("u_*", async function () {
    const sql = `SELECT * FROM \`${util.project}.bq_extension_vscode_test.u_*\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const hover: Hover = (
      await vscode.commands.executeCommand(
        "vscode.executeHoverProvider",
        util.getDocUri(filename),
        new vscode.Position(0, sql.length - 1)
      )
    )[0];
    const items = hover.contents.map((x) => x.value);
    assert.ok(items.some((x) => x === "str: STRING"));
  });
  it("u_20210101", async function () {
    const sql = `SELECT * FROM \`${util.project}.bq_extension_vscode_test.u_20210101\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const hover: Hover = (
      await vscode.commands.executeCommand(
        "vscode.executeHoverProvider",
        util.getDocUri(filename),
        new vscode.Position(0, sql.length - 1)
      )
    )[0];
    const items = hover.contents.map((x) => x.value);
    assert.ok(items.some((x) => x === "str: STRING"));
  });
  it("cast()", async function () {
    const sql = `
SELECT cast('1' AS INT64)`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const hover: Hover = (
      await vscode.commands.executeCommand(
        "vscode.executeHoverProvider",
        util.getDocUri(filename),
        new vscode.Position(1, 7)
      )
    )[0];
    const items = hover.contents.map((x) => x.value);
    assert.ok(items.some((x) => x.includes("CAST")));
  });
  it("net.ipv4_from_int64()", async function () {
    const sql = `
SELECT net.ipv4_from_int64(0)`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const hover: Hover = (
      await vscode.commands.executeCommand(
        "vscode.executeHoverProvider",
        util.getDocUri(filename),
        new vscode.Position(1, 11)
      )
    )[0];
    const items = hover.contents.map((x) => x.value);
    assert.ok(items.some((x) => x.includes("IPV4_FROM_INT64")));
  });
});
