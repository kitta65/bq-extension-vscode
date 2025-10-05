import * as assert from "assert";
import * as vscode from "vscode";
import * as util from "./util";

const filename = "completion.bq";

describe("Completion", function () {
  let projectId: string;
  before(async function () {
    projectId = await util.getProjectId();
  });
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
      new vscode.Position(0, sql.length),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        // case insensitive compare (to ignore user config)
        (x) =>
          x.label.toString().toUpperCase() === "CURRENT_TIMESTAMP" &&
          x.kind === vscode.CompletionItemKind.Function,
      ),
    );
  });

  it("not global function", async function () {
    const sql = "SELECT net."; // NOTE Actually, any string is OK.
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(0, sql.length),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        // case insensitive compare (to ignore user config)
        (x) =>
          x.label.toString().toUpperCase() === "IPV4_FROM_INT64" &&
          x.kind === vscode.CompletionItemKind.Function,
      ),
    );
  });

  it("project", async function () {
    const sql = "SELECT * FROM ``";
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(0, sql.length - 1),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) =>
          x.label === projectId && x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
  });

  it("dataset", async function () {
    const sql = `SELECT * FROM \`${projectId}.\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(0, sql.length - 1),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "bq_extension_vscode_test" &&
          x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
  });

  it("table_name", async function () {
    const sql = `SELECT * FROM \`${projectId}.bq_extension_vscode_test.\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(0, sql.length - 1),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "t" && x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
  });

  it("table_name_asia", async function () {
    const sql = `SELECT * FROM \`${projectId}.bq_extension_vscode_test_asia.\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(0, sql.length - 1),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "v" && x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
  });

  it("table_name without project", async function () {
    const sql = `SELECT * FROM \`bq_extension_vscode_test.\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(0, sql.length - 1),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "t" && x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
  });

  it("table_name (table suffix)", async function () {
    const sql = `SELECT * FROM \`${projectId}.bq_extension_vscode_test.\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(0, sql.length - 1),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "u_*" && x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
    assert.ok(
      !list.items.some(
        (x) =>
          x.label === "u_20210101" &&
          x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
    assert.ok(
      !list.items.some(
        (x) =>
          x.label === "u_20210102" &&
          x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
  });

  it("column", async function () {
    // NOTE `s` is neeeded to parse sql!
    const sql = `
SELECT
  s
FROM \`${projectId}.bq_extension_vscode_test.t\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 3),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "str" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("column without first character", async function () {
    const sql = `
SELECT

FROM \`${projectId}.bq_extension_vscode_test.t\``;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 0),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "str" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("column end of statement", async function () {
    // NOTE `s` is neeeded to parse sql!
    const sql = `
SELECT *
FROM \`${projectId}.bq_extension_vscode_test.t\`
WHERE
  s`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(4, 3),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "str" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
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
      new vscode.Position(3, 3),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "one" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
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
      new vscode.Position(6, 5),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "one" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("column (ident.*)", async function () {
    const sql = `
WITH
temp1 AS (SELECT 1 AS foo),
temp2 AS (SELECT temp1.* FROM temp1)

SELECT temp2.
FROM temp2`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(5, 13),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "foo" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("table alias", async function () {
    const sql = `
SELECT
  t
FROM \`${projectId}.bq_extension_vscode_test.t\` AS tmp`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 3),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "tmp" && x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
  });

  it("table alias join former", async function () {
    const sql = `
SELECT
  f
FROM
  \`${projectId}.bq_extension_vscode_test.t\` AS former
  , (SELECT 1) AS latter`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 3),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "former" && x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
  });

  it("table alias join latter", async function () {
    const sql = `
SELECT
  l
FROM
  \`${projectId}.bq_extension_vscode_test.t\` AS former
  , (SELECT 1 one) AS latter`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 3),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "latter" && x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
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
      new vscode.Position(2, 3),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "one" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
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
      new vscode.Position(2, 3),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "one" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
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
      new vscode.Position(2, 3),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "one" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("column exists subquery", async function () {
    const sql = `
SELECT *
FROM tablename
WHERE EXISTS(
  SELECT 1
  FROM \`${projectId}.bq_extension_vscode_test.t\`
  WHERE t
)`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(6, 9), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(6, 10),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "str" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("column subquery as column", async function () {
    const sql = `
SELECT (
  SELECT 
  FROM \`${projectId}.bq_extension_vscode_test.t\`
)`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 9),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "str" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
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
      new vscode.Position(5, 3),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "one" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
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
      new vscode.Position(5, 3),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "tmp" && x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
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
      new vscode.Position(5, 6),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "one" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("column with alias (refine existing table)", async function () {
    const sql = `
WITH
  t AS (SELECT 1 AS one FROM \`${projectId}.bq_extension_vscode_test.t\`),
  other_cte AS (SELECT 1 AS two)
SELECT t
FROM t`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(4, 8), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(4, 9),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "one" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
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
      new vscode.Position(5, 3),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "renamed" && x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
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
      new vscode.Position(5, 10),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "one" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
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
      new vscode.Position(2, 8),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "tmp" && x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
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
      new vscode.Position(6, 8),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "one" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
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
      new vscode.Position(4, 11),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "one" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
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
      new vscode.Position(4, 9),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "one" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("with and group (column)", async function () {
    const sql = `
WITH tmp AS (SELECT 1 AS one)
(SELECT o FROM tmp)`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 9),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "one" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
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
      new vscode.Position(6, 12),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "one" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
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
      new vscode.Position(6, 9),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "temp" && x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
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
      new vscode.Position(7, 10),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "temp" && x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
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
      new vscode.Position(4, 9),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "temp2" && x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
  });

  it("column leaded by table", async function () {
    const sql = `
SELECT
  tmp
FROM \`${projectId}.bq_extension_vscode_test.t\` AS tmp`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(2, 5), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 6),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "str" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("column leaded by table end of statement", async function () {
    const sql = `
SELECT *
FROM \`${projectId}.bq_extension_vscode_test.t\` AS tmp
WHERE 0 < tmp`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(3, 13), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(3, 14),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "str" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("column leaded by table subquery", async function () {
    const sql = `
SELECT *
FROM \`${projectId}.bq_extension_vscode_test.t\` AS tmp1
WHERE EXISTS(
  SELECT *
  FROM \`${projectId}.bq_extension_vscode_test.u_*\` AS tmp2
  WHERE tmp2.str = tmp1
)`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(6, 23), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(6, 24),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "str" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("struct", async function () {
    const sql = `
SELECT nested
FROM \`${projectId}.bq_extension_vscode_test.t\`
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(1, 13), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(1, 14),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "int2" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("struct subquery", async function () {
    const sql = `
SELECT *
FROM \`${projectId}.bq_extension_vscode_test.t\` AS tmp1
WHERE EXISTS(
  SELECT *
  FROM \`${projectId}.bq_extension_vscode_test.u_*\` AS tmp2
  WHERE tmp2.str = tmp1.nested
)
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(6, 30), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(6, 31),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "int2" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("deep struct", async function () {
    const sql = `
SELECT nested.nested2.nested3
FROM \`${projectId}.bq_extension_vscode_test.t\` AS tmp1
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(1, 29), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(1, 30),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "str4" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("deep struct subquery", async function () {
    const sql = `
SELECT *
FROM \`${projectId}.bq_extension_vscode_test.t\` AS tmp1
WHERE EXISTS(
  SELECT *
  FROM \`${projectId}.bq_extension_vscode_test.u_*\` AS tmp2
  WHERE tmp2.str = tmp1.nested.nested2.nested3
)
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    await util.insert(filename, new vscode.Position(6, 46), ".");
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(6, 47),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "str4" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("pivot operator (single, no alias for aggregation)", async function () {
    const sql = `
WITH temp AS (
  SELECT 1 AS groupby, 2 AS value union all
  SELECT 2 AS groupby, 3 AS value
)
SELECT 
FROM temp PIVOT (
  SUM(value)
  FOR groupby IN (1 AS one, 2 AS two)
)
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(5, 7),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "one" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("pivot operator (single, no alias for integer pivot column)", async function () {
    const sql = `
WITH temp AS (
  SELECT 1 AS groupby, 2 AS value union all
  SELECT 2 AS groupby, 3 AS value
)
SELECT 
FROM temp PIVOT (
  SUM(value) AS s
  FOR groupby IN (1, 2)
)
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(5, 7),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "s_1" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("pivot operator (single, no alias for string pivot column)", async function () {
    const sql = `
WITH temp AS (
  SELECT 'a' AS groupby, 2 AS value union all
  SELECT 'あ' AS groupby, 3 AS value
)
SELECT 
FROM temp PIVOT (
  SUM(value) AS s
  FOR groupby IN ('a', 'あ')
)
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(5, 7),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "s_a" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "`s_あ`" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("pivot operator (single, with `.`)", async function () {
    const sql = `
WITH t AS (
  SELECT 'a' AS groupby, 2 AS value union all
  SELECT 'あ' AS groupby, 3 AS value
)
SELECT p.
FROM t PIVOT (
  SUM(value) AS s
  FOR groupby IN ('a', 'あ')
) AS p
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(5, 9),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "s_a" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "`s_あ`" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("pivot operator (multiple)", async function () {
    const sql = `
WITH temp AS (
  SELECT 1 AS groupby, 2 AS value union all
  SELECT 2 AS groupby, 3 AS value
)
SELECT 
FROM temp PIVOT (
  SUM(value) AS sum_value, AVG(value) AS avg_value
  FOR groupby IN (1 AS one, 2 AS two)
)
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(5, 7),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "sum_value_one" &&
          x.kind === vscode.CompletionItemKind.Field,
      ),
    );
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "avg_value_two" &&
          x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("unpivot operator (single)", async function () {
    const sql = `
WITH temp AS (
  SELECT 1 AS one, 2 AS two, 3 AS three
)
SELECT 
FROM temp UNPIVOT (new_col_name FOR original_col_name IN (one, two, three))
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(4, 7),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "new_col_name" &&
          x.kind === vscode.CompletionItemKind.Field,
      ),
    );
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "original_col_name" &&
          x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("unpivot operator (multiple)", async function () {
    const sql = `
WITH temp AS (
  SELECT 1 AS one, 2 AS two, 3 AS three, 4 AS four
)
SELECT 
FROM temp UNPIVOT (
  (first_col, second_col)
  FOR input_columns
  IN ((one, two) AS 'group_a', (three, four) AS 'group_b')
)
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(4, 7),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "first_col" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "input_columns" &&
          x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("from with WithClause", async function () {
    const sql = `
WITH temp AS (SELECT 1 AS one)
FROM t
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 6),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "temp" && x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
  });

  it("pipe with WithClause", async function () {
    const sql = `
WITH foo AS (SELECT 1 AS one)
FROM bar
|> CROSS JOIN f
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(3, 15),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "foo" && x.kind === vscode.CompletionItemKind.Struct,
      ),
    );
  });

  it("from then select", async function () {
    const sql = `
FROM \`${projectId}.bq_extension_vscode_test.t\`
|> SELECT 
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(2, 10),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "str" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("after select pipe operator", async function () {
    const sql = `
FROM \`${projectId}.bq_extension_vscode_test.t\`
|> SELECT *, "" AS new_col
|> SELECT 
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(3, 10),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "str" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "new_col" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("after where pipe operator", async function () {
    const sql = `
FROM \`${projectId}.bq_extension_vscode_test.t\`
|> WHERE TRUE
|> SELECT 
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(3, 10),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "str" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("after drop pipe operator", async function () {
    const sql = `
FROM \`${projectId}.bq_extension_vscode_test.t\`
|> DROP str
|> SELECT 
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(3, 10),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "arr" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
    assert.ok(
      !list.items.some(
        (x) => x.label === "str" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("after extend pipe operator", async function () {
    const sql = `
FROM \`${projectId}.bq_extension_vscode_test.t\`
|> EXTEND "" AS new_col
|> SELECT 
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(3, 10),
    )) as vscode.CompletionList;
    assert.ok(
      list.items.some(
        (x) => x.label === "str" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "new_col" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });

  it("after rename pipe operator", async function () {
    const sql = `
FROM \`${projectId}.bq_extension_vscode_test.t\`
|> RENAME str AS new_str
|> SELECT 
`;
    await util.insert(filename, new vscode.Position(0, 0), sql);
    const list = (await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      util.getDocUri(filename),
      new vscode.Position(3, 10),
    )) as vscode.CompletionList;
    assert.ok(
      !list.items.some(
        (x) => x.label === "str" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
    assert.ok(
      list.items.some(
        (x) =>
          x.label === "new_str" && x.kind === vscode.CompletionItemKind.Field,
      ),
    );
  });
});
