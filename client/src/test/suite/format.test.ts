import * as assert from "assert";
import * as vscode from "vscode";
import * as util from "./util";

const filename = "format.bq";

describe("Format", function () {
  beforeEach(async function () {
    await util.createTextDocument(filename);
  });
  afterEach(async function () {
    await util.deleteTextDocument(filename);
  });
  it("format", async function () {
    const sql = "SELECT 1    ;";
    util.insert(filename, new vscode.Position(0, 0), sql);
    await vscode.commands.executeCommand(
      "vscode.executeFormatDocumentProvider",
      util.getDocUri(filename),
    );
    const texts = vscode.workspace.textDocuments.filter(
      (text) => text.fileName.endsWith(filename), // it is a little optimistic, but OK
    );
    assert.equal(texts.length, 1);
    const text = texts[0];
    const actual = text.getText();
    assert.equal(actual, "SELECT 1;");
  });
});
