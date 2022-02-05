import * as assert from "assert";
import * as vscode from "vscode";
import * as util from "./util";

const filename = "completion.bq";

describe("Completion", function () {
  beforeEach(async function () {
    await util.createTextDocument(filename);
  });
  afterEach(async function () {
    await util.deleteTextDocument(filename);
  });
  it("function", async function () {
    const sql = "SELECT C"; // NOTE Actually, any string is OK.
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(0, sql.length)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "CURRENT_TIMESTAMP"));
  });
  it("not global function", async function () {
    const sql = "SELECT net."; // NOTE Actually, any string is OK.
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(0, sql.length)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "IPV4_FROM_INT64"));
  });
  it("project", async function () {
    const sql = "SELECT * FROM ``";
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(0, sql.length - 1)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === util.project));
  });
  it("dataset", async function () {
    const sql = `SELECT * FROM \`${util.project}.\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(0, sql.length - 1)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "bq_extension_vscode_test"));
  });
  it("table_name", async function () {
    const sql = `SELECT * FROM \`${util.project}.bq_extension_vscode_test.\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(0, sql.length - 1)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "t"));
  });
  it("table_name without project", async function () {
    const sql = `SELECT * FROM \`bq_extension_vscode_test.\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(0, sql.length - 1)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "t"));
  });
  it("table_name (table suffix)", async function () {
    const sql = `SELECT * FROM \`${util.project}.bq_extension_vscode_test.\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(0, sql.length - 1)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "u_*"));
    assert.ok(!list.items.some((x) => x.label === "u_20210101"));
    assert.ok(!list.items.some((x) => x.label === "u_20210102"));
  });
  it("column", async function () {
    // NOTE `s` is neeeded to parse sql!
    const sql = `
SELECT
  s
FROM \`${util.project}.bq_extension_vscode_test.t\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 3)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "str"));
  });
  it("column without first character", async function () {
    // NOTE `s` is neeeded to parse sql!
    const sql = `
SELECT

FROM \`${util.project}.bq_extension_vscode_test.t\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 0)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "str"));
  });
  it("column end of statement", async function () {
    // NOTE `s` is neeeded to parse sql!
    const sql = `
SELECT *
FROM \`${util.project}.bq_extension_vscode_test.t\`
WHERE
  s`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(4, 3)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "str"));
  });
  it("column (not explicit alias)", async function () {
    const sql = `
SELECT
  *,
  o
FROM (SELECT sub.one FROM (SELECT 1 AS one) AS sub)`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(3, 3)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "one"));
  });
  it("column (from with clause in subquery)", async function () {
    const sql = `
WITH abc AS (SELECT 1 AS one)
SELECT *
FROM (
  SELECT
    *,
    o
  FROM abc
)`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(6, 5)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "one"));
  });
  it("table alias", async function () {
    const sql = `
SELECT
  t
FROM \`${util.project}.bq_extension_vscode_test.t\` AS tmp`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 3)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "tmp"));
  });
  it("table alias join former", async function () {
    const sql = `
SELECT
  f
FROM
  \`${util.project}.bq_extension_vscode_test.t\` AS former
  , (SELECT 1) AS latter`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 3)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "former"));
  });
  it("table alias join latter", async function () {
    const sql = `
SELECT
  l
FROM
  \`${util.project}.bq_extension_vscode_test.t\` AS former
  , (SELECT 1 one) AS latter`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 3)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "latter"));
  });
  it("column subquery", async function () {
    const sql = `
SELECT
  o
FROM (
  SELECT 1 AS one
)`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 3)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "one"));
  });
  it("column subquery and set operator", async function () {
    const sql = `
SELECT
  o
FROM (
  SELECT 1 AS one
  UNION ALL
  SELECT 2
)`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 3)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "one"));
  });
  it("column subquery and set operator and groupedStatement", async function () {
    const sql = `
SELECT
  o
FROM (
  (SELECT 1 AS one)
  UNION ALL
  SELECT 2
)`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 3)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "one"));
  });
  it("column with", async function () {
    const sql = `
WITH tmp AS (
  SELECT 1 AS one
)
SELECT
  o
FROM tmp`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(5, 3)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "one"));
  });
  it("with alias", async function () {
    const sql = `
WITH tmp AS (
  SELECT 1 AS one
)
SELECT
  t
FROM tmp`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(5, 3)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "tmp"));
  });
  it("column with alias", async function () {
    const sql = `
WITH tmp AS (
  SELECT 1 AS one
)
SELECT
  tmp
FROM tmp`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(5, 5), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(5, 6)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "one"));
  });
  it("with alias rename", async function () {
    const sql = `
WITH tmp AS (
  SELECT 1 AS one
)
SELECT
  r
FROM tmp AS renamed`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(5, 3)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "renamed"));
  });
  it("column with alias rename", async function () {
    const sql = `
WITH tmp AS (
  SELECT 1 AS one
)
SELECT
  renamed
FROM tmp AS renamed`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(5, 9), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(5, 10)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "one"));
  });
  it("with and set operator", async function () {
    const sql = `
WITH tmp AS (SELECT 1 AS one)
SELECT t
FROM tmp
UNION ALL
SELECT 1`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 8)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "tmp"));
  });
  it("with and set operator (column)", async function () {
    const sql = `
WITH tmp AS (SELECT 1 AS one)
SELECT 1
UNION ALL
SELECT 2
UNION ALL
SELECT o
FROM tmp`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(6, 8)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "one"));
  });
  it("with and set operator (table.column)", async function () {
    const sql = `
WITH tmp AS (SELECT 1 AS one)
SELECT 1
UNION ALL
SELECT tmp
FROM tmp`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(4, 10), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(4, 11)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "one"));
  });
  it("with and set operator and group (column)", async function () {
    const sql = `
WITH tmp AS (SELECT 1 AS one)
SELECT 1
UNION ALL
(SELECT o FROM tmp)`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(4, 9)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "one"));
  });
  it("with and group (column)", async function () {
    const sql = `
WITH tmp AS (SELECT 1 AS one)
(SELECT o FROM tmp)`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 9)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "one"));
  });
  it("column in leading with query", async function () {
    const sql = `
WITH
  tmp1 AS (
    SELECT 1 AS one
  ),
  tmp2 AS (
    SELECT o
    FROM tmp1
  )
SELECT 1`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(6, 12)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "one"));
  });
  it("with alias recursive", async function () {
    const sql = `
WITH RECURSIVE
  temp AS (
    SELECT 1 as n
    UNION ALL
    SELECT 1 + n
    FROM 
    WHERE n < 3
  )
SELECT * FROM T1
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(6, 9)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "temp"));
  });
  it("column with recursive", async function () {
    const sql = `
WITH RECURSIVE
  temp AS (
    SELECT 1 as n
    UNION ALL
    SELECT 1 + n
    FROM temp
    WHERE 
  )
SELECT * FROM T1
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(7, 10)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "temp"));
  });
  it("column with recursive", async function () {
    const sql = `
WITH RECURSIVE
  temp1 AS (
    SELECT n
    FROM 
  ),
  temp2 AS (SELECT 1 AS n)
SELECT * FROM temp1
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(4, 9)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "temp2"));
  });
  it("column leaded by table", async function () {
    const sql = `
SELECT
  tmp
FROM \`${util.project}.bq_extension_vscode_test.t\` AS tmp`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(2, 5), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 6)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "str"));
  });
  it("column leaded by table end of statement", async function () {
    const sql = `
SELECT *
FROM \`${util.project}.bq_extension_vscode_test.t\` AS tmp
WHERE 0 < tmp`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(3, 13), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(3, 14)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "str"));
  });
  it("column leaded by table subquery", async function () {
    const sql = `
SELECT *
FROM \`${util.project}.bq_extension_vscode_test.t\` AS tmp1
WHERE EXISTS(
  SELECT *
  FROM \`${util.project}.bq_extension_vscode_test.u_*\` AS tmp2
  WHERE tmp2.str = tmp1
)`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(6, 23), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(6, 24)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "str"));
  });
  it("struct", async function () {
    const sql = `
SELECT nested
FROM \`${util.project}.bq_extension_vscode_test.t\`
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(1, 13), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(1, 14)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "int2"));
  });
  it("struct subquery", async function () {
    const sql = `
SELECT *
FROM \`${util.project}.bq_extension_vscode_test.t\` AS tmp1
WHERE EXISTS(
  SELECT *
  FROM \`${util.project}.bq_extension_vscode_test.u_*\` AS tmp2
  WHERE tmp2.str = tmp1.nested
)
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(6, 30), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(6, 31)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "int2"));
  });
  it("deep struct", async function () {
    const sql = `
SELECT nested.nested2.nested3
FROM \`${util.project}.bq_extension_vscode_test.t\` AS tmp1
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(1, 29), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(1, 30)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "str4"));
  });
  it("deep struct subquery", async function () {
    const sql = `
SELECT *
FROM \`${util.project}.bq_extension_vscode_test.t\` AS tmp1
WHERE EXISTS(
  SELECT *
  FROM \`${util.project}.bq_extension_vscode_test.u_*\` AS tmp2
  WHERE tmp2.str = tmp1.nested.nested2.nested3
)
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(6, 46), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(6, 47)
    )) as vscode.CompletionList;
    assert.ok(list.items.some((x) => x.label === "str4"));
  });
});
