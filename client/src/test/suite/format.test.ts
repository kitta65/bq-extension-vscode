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
    const sql = "SELECT 1 one;\n";
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const res: Array<{ newText: string }> =
      await vscode.commands.executeCommand(
        "vscode.executeFormatDocumentProvider",
        util.getDocUri(filename),
        { insertSpaces: true, tabSize: 2 } as vscode.FormattingOptions,
      );
    assert.equal(res.length, 1);
    assert.equal(res[0].newText.toLowerCase().trim(), "as");
  });
});
