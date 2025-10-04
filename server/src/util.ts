import * as bq2cst from "bq2cst";
import * as LSP from "vscode-languageserver/node";
import { type TableSchema } from "@google-cloud/bigquery";

export type DocumentInfo = {
  text: string;
  tokens: bq2cst.Token[];
  cst: bq2cst.UnknownNode[];
};

export function breakdownTokens(tokens: bq2cst.Token[]) {
  const res: string[] = [];
  for (const t of tokens) {
    const matchingResult = t.literal.match(/^`(.+)`$/);
    if (matchingResult) {
      matchingResult[1].split(".").forEach((x) => res.push(x));
    } else {
      res.push(t.literal);
    }
  }
  return res;
}

export function convert2MarkdownContent(code: string): LSP.MarkupContent {
  return {
    kind: "markdown",
    value: ["```sql", code, "```"].join("\n"),
  };
}

export function convert2MarkdownItems(arg: string[]): LSP.MarkupContent;
export function convert2MarkdownItems(
  arg: Record<string, string>,
): LSP.MarkupContent;
export function convert2MarkdownItems(
  arg: string[] | Record<string, string>,
): LSP.MarkupContent {
  function escape(str: string) {
    return str
      .replaceAll("<", "\\<")
      .replaceAll(">", "\\>")
      .replaceAll("_", "\\_");
  }

  let value = "";
  if (Array.isArray(arg)) {
    if (arg.length === 0) {
      value = "* Unknown";
    } else {
      value = arg.map((i) => "* " + i).join("\n");
    }
  } else {
    const items = [];
    for (const [k, v] of Object.entries(arg)) {
      items.push(`* ${k}: ${v}`);
    }
    if (items.length === 0) {
      items.push("* Unknown");
    }
    value = items.join("\n");
  }
  return { kind: "markdown", value: escape(value) };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes}B`;
  } else if (bytes < 1024 ** 2) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  } else if (bytes < 1024 ** 3) {
    return `${(bytes / 1024 ** 2).toFixed(1)}MB`;
  } else if (bytes < 1024 ** 4) {
    return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
  } else if (bytes < 1024 ** 5) {
    return `${(bytes / 1024 ** 4).toFixed(1)}TB`;
  } else {
    return `${(bytes / 1024 ** 5).toFixed(1)}PB`;
  }
}

export function getAllDescendants(
  node: bq2cst.UnknownNode,
): bq2cst.UnknownNode[] {
  const res: bq2cst.UnknownNode[] = [];
  function pushDescendants(node: bq2cst.UnknownNode) {
    const children = getAllChildren(node);
    children.forEach((c) => {
      pushDescendants(c);
      res.push(c);
    });
  }
  pushDescendants(node);
  return res;
}

export function getAllChildren(node: bq2cst.UnknownNode): bq2cst.UnknownNode[] {
  const res: bq2cst.UnknownNode[] = [];
  for (const [_, child] of Object.entries(node.children)) {
    if (!child) {
      continue;
    } else if ("Node" in child) {
      res.push(child.Node);
    } else {
      child.NodeVec.forEach((n) => res.push(n));
    }
  }
  return res;
}

function getFirstNode(node: bq2cst.UnknownNode): bq2cst.UnknownNode {
  // NOTE maybe you can limit candidates using UnknownNode.range .
  const candidates = getAllDescendants(node);
  let res = node;
  for (const c of candidates) {
    if (!c.token) {
      continue;
    }
    if (!res.token) {
      res = c;
      continue;
    }
    if (
      c.token.line < res.token.line ||
      (c.token.line === res.token.line && c.token.column < res.token.column)
    ) {
      res = c;
    }
  }
  return res;
}

function getLastNode(node: bq2cst.UnknownNode): bq2cst.UnknownNode {
  // NOTE maybe you can limit candidates using UnknownNode.range .
  const candidates = getAllDescendants(node);
  let res = node;
  for (const c of candidates) {
    if (!c.token) {
      continue;
    }
    if (!res.token) {
      res = c;
      continue;
    }
    if (
      res.token.line < c.token.line ||
      (res.token.line === c.token.line && res.token.column < c.token.column)
    ) {
      res = c;
    }
  }
  return res;
}

export function getNodeByRowColumn(
  csts: bq2cst.UnknownNode[],
  line: number,
  column: number,
) {
  // line, column... 1-based index
  function findNodeFromCst(cst: bq2cst.UnknownNode): bq2cst.UnknownNode | null {
    if (
      cst.range.start &&
      cst.range.end &&
      arrangedInThisOrder(
        true,
        cst.range.start,
        { line: line, character: column },
        cst.range.end,
      )
    ) {
      if (cst.token) {
        const splittedLiteral = cst.token.literal.split("\n");
        const startPosition = {
          line: cst.token.line,
          character: cst.token.column,
        };
        const endPosition = {
          line: cst.token.line + splittedLiteral.length - 1,
          character:
            splittedLiteral.length === 1
              ? cst.token.column + splittedLiteral[0].length - 1
              : splittedLiteral[splittedLiteral.length - 1].length,
        };
        if (
          arrangedInThisOrder(
            true,
            startPosition,
            { line: line, character: column },
            endPosition,
          )
        ) {
          return cst;
        }
      }
      for (const [_, child] of Object.entries(cst.children)) {
        if (child && "Node" in child) {
          const res = findNodeFromCst(child.Node);
          if (res) {
            return res;
          }
        } else if (child) {
          for (const node of child.NodeVec) {
            const res = findNodeFromCst(node);
            if (res) {
              return res;
            }
          }
        }
      }
    }
    return null;
  }
  for (const cst of csts) {
    const res = findNodeFromCst(cst);
    if (res) {
      return res;
    }
  }
  return null;
}

export function getNodeRange(node: bq2cst.UnknownNode): {
  start: { line: number; column: number };
  end: { line: number; column: number };
} | null {
  const firstToken = getFirstNode(node).token;
  const lastToken = getLastNode(node).token;
  if (!firstToken || !lastToken) {
    return null;
  }
  const splittedLastLiteral = lastToken.literal.split("\n");
  return {
    start: {
      line: firstToken.line,
      column: firstToken.column,
    },
    end: {
      line: lastToken.line + splittedLastLiteral.length - 1,
      column:
        splittedLastLiteral.length === 1
          ? lastToken.column + lastToken.literal.length - 1
          : splittedLastLiteral[splittedLastLiteral.length - 1].length,
    },
  };
}

export function isNodeChild(child: unknown): child is bq2cst.NodeChild {
  if (
    child &&
    typeof child === "object" &&
    Object.keys(child).length === 1 &&
    "Node" in child
  ) {
    return true;
  }
  return false;
}

export function isNodeVecChild(child: unknown): child is bq2cst.NodeVecChild {
  if (
    child &&
    typeof child === "object" &&
    Object.keys(child).length === 1 &&
    "NodeVec" in child
  ) {
    return true;
  }
  return false;
}

export function getTokenRangeByRowColumn(
  docInfo: DocumentInfo,
  line: number,
  column: number,
): LSP.Range | null {
  // line, column... 1-based index

  // start position
  const start = { line: line - 1, character: column - 1 };

  // end position
  const token = getTokenByRowColumn(docInfo, line, column);
  if (!token) {
    return null;
  }
  const splittedLiteral = token.literal.split("\n");
  let endLine;
  let endChacter;
  if (splittedLiteral.length === 1) {
    endLine = start.line;
    endChacter =
      start.character + splittedLiteral[splittedLiteral.length - 1].length;
  } else {
    endLine = start.line + splittedLiteral.length - 1;
    endChacter = splittedLiteral[splittedLiteral.length - 1].length;
  }
  const end = {
    line: endLine,
    character: endChacter,
  };

  return { start: start, end: end };
}

export function getPositionByRowColumn(
  docInfo: DocumentInfo,
  line: number,
  column: number,
) {
  // line, column... 1-based index
  const rowLengthArr = docInfo.text.split("\n").map((x) => x.length + 1); // add length of "\n"
  const position =
    rowLengthArr.slice(0, line - 1).reduce((x, y) => x + y, 0) + (column - 1);
  return position;
}

export function getTokenByRowColumn(
  docInfo: DocumentInfo,
  line: number,
  column: number,
) {
  // line, column... 1-based index
  const targetPosition = getPositionByRowColumn(docInfo, line, column);
  const tokens = docInfo.tokens;
  if (tokens.length === 0) {
    return null;
  }
  let res = tokens[docInfo.tokens.length - 1];
  for (let i = 1; i < docInfo.tokens.length; i++) {
    const token = docInfo.tokens[i];
    const tokenPosition = getPositionByRowColumn(
      docInfo,
      token.line,
      token.column,
    );
    if (targetPosition < tokenPosition) {
      res = docInfo.tokens[i - 1];
      break;
    }
  }
  return res;
}

export function parseIdentifier(node: bq2cst.UnknownNode): string[] {
  function parseUntilLeaf(node: bq2cst.UnknownNode): string[] {
    if (node.node_type === "Identifier") {
      // identifier or `project.dataset.table`
      const quoted = node.token.literal.match(/^`([^`]*)`$/);
      if (quoted) {
        return quoted[1].split(".");
      } else {
        return [node.token.literal];
      }
    } else if (node.node_type === "MultiTokenIdentifier") {
      // identifier-with-dash
      let concatenatedLiteral = node.token.literal;
      for (const child of node.children.trailing_idents.NodeVec) {
        concatenatedLiteral = concatenatedLiteral + child.token.literal;
      }
      return concatenatedLiteral.split(".");
    } else if (node.node_type === "DotOperator") {
      // .
      const res: string[] = [];
      parseUntilLeaf(node.children.left.Node).forEach((n) => res.push(n));
      parseUntilLeaf(node.children.right.Node).forEach((n) => res.push(n));
      return res;
    } else {
      if (node.token) {
        return [node.token.literal];
      }
      return [];
    }
  }

  let root = node;
  for (;;) {
    if (!root.parent) break;
    const parent = root.parent.deref();
    if (!parent) break;
    if (
      parent.node_type === "DotOperator" ||
      parent.node_type === "MultiTokenIdentifier"
    ) {
      root = parent;
    } else {
      break;
    }
  }
  return parseUntilLeaf(root);
}

export function parseStruct(
  str: string,
  prefix: string[],
): { type: string; path: string[] }[] {
  // str... STRUCT<arr ARRAY<INT64>, str STRING, nested STRUCT<nested2 STRUCT<str2 STRING>, int INT64>>
  const match = str.match(/^\s*STRUCT<(.*)>\s*$/);
  if (!match) return [];

  const insideAngleBracket = match[1];
  const fields: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < insideAngleBracket.length; i++) {
    if (insideAngleBracket[i] === "<") {
      depth += 1;
    } else if (insideAngleBracket[i] === ">") {
      depth -= 1;
    } else if (insideAngleBracket[i] === "," && depth === 0) {
      fields.push(insideAngleBracket.substring(start, i));
      start = i + 1;
    }
  }
  fields.push(insideAngleBracket.substring(start)); // last field

  const res: { type: string; path: string[] }[] = [];
  fields.forEach((f) => {
    const match = f.match(/^\s*(\S+)\s(.*)$/);
    if (match) {
      res.push({ type: match[2], path: [...prefix, match[1]] });
      res.push(...parseStruct(match[2], [...prefix, match[1]]));
    }
  });

  return res;
}

export function arrangedInThisOrder(
  allowEqual: boolean,
  ...positions: LSP.Position[]
) {
  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const next = positions[i];
    if (prev.line < next.line) {
      continue;
    } else if (prev.line > next.line) {
      return false;
    }
    // prev.line === next.line
    if (allowEqual && prev.character > next.character) {
      return false;
    } else if (!allowEqual && prev.character >= next.character) {
      return false;
    }
  }
  return true;
}

export function rangeContains(
  range1: { start: LSP.Position; end: LSP.Position },
  range2: { start: LSP.Position; end: LSP.Position },
): boolean {
  // validation
  for (const r of [range1, range2]) {
    if (arrangedInThisOrder(false, r.end, r.start)) {
      throw new Error("invalid range");
    }
  }

  if (arrangedInThisOrder(false, range2.start, range1.start)) return false;
  if (arrangedInThisOrder(false, range1.end, range2.end)) return false;

  return true;
}

export function parseSQL(sql: string): bq2cst.UnknownNode[] {
  function setParentAndRange(parent: bq2cst.UnknownNode) {
    const weakref = new WeakRef(parent);
    parent.range = {
      start: null,
      end: null,
    };
    const token = parent.token;
    if (token) {
      parent.range.start = { line: token.line, character: token.column };
      const splittedLiteral = token.literal.split("\n");
      parent.range.end = {
        line: token.line + splittedLiteral.length - 1,
        character:
          splittedLiteral.length === 1
            ? token.column + token.literal.length - 1
            : splittedLiteral[splittedLiteral.length - 1].length,
      };
    }
    for (const [_, child] of Object.entries(parent.children)) {
      if (!child) {
        continue;
      } else if ("Node" in child) {
        child.Node.parent = weakref;
        setParentAndRange(child.Node);
        if (
          parent.range.start &&
          child.Node.range.start &&
          arrangedInThisOrder(false, child.Node.range.start, parent.range.start)
        ) {
          parent.range.start = child.Node.range.start;
        } else if (!parent.range.start && child.Node.range.start) {
          parent.range.start = child.Node.range.start;
        }
        if (
          parent.range.end &&
          child.Node.range.end &&
          arrangedInThisOrder(false, parent.range.end, child.Node.range.end)
        ) {
          parent.range.end = child.Node.range.end;
        } else if (!parent.range.end && child.Node.range.end) {
          parent.range.end = child.Node.range.end;
        }
      } else {
        child.NodeVec.forEach((node) => {
          node.parent = weakref;
          setParentAndRange(node);
          if (
            parent.range.start &&
            node.range.start &&
            arrangedInThisOrder(false, node.range.start, parent.range.start)
          ) {
            parent.range.start = node.range.start;
          } else if (!parent.range.start && node.range.start) {
            parent.range.start = node.range.start;
          }
          if (
            parent.range.end &&
            node.range.end &&
            arrangedInThisOrder(false, parent.range.end, node.range.end)
          ) {
            parent.range.end = node.range.end;
          } else if (!parent.range.end && node.range.end) {
            parent.range.end = node.range.end;
          }
        });
      }
    }
  }

  const csts = bq2cst.parse(sql);
  csts.forEach((cst) => {
    setParentAndRange(cst);
  });
  return csts;
}

export function getFullTableNameFromNode(node: bq2cst.UnknownNode): string {
  if (node.node_type === "DotOperator") {
    const left = getFullTableNameFromNode(node.children.left.Node);
    const right = getFullTableNameFromNode(node.children.right.Node);
    return `${left}.${right}`;
  } else if (node.node_type === "MultiTokenIdentifier") {
    const trailing = node.children.trailing_idents.NodeVec.map(
      (node) => node.token.literal,
    ).join("");
    return `${node.token.literal}${trailing}`;
  }

  const literal = node?.token?.literal || "";
  return literal.replaceAll("`", "");
}

const schemaMap: { [key: string]: string } = {
  INTEGER: "INT64",
  FLOAT: "FLOAT64",
  BOOLEAN: "BOOL",
};
export function sqlStyleSchema(
  schema: NonNullable<TableSchema["fields"]>[number],
): string {
  let res = schema.type || "UNKNOWN";
  res = schemaMap[res] || res;
  if (schema.type === "RANGE") {
    res = `RANGE<${schema.rangeElementType?.type || "UNKNOWN"}>`;
  } else if (schema.type === "RECORD") {
    const fields = schema.fields || [];
    const innerSchema = fields
      .map((f) => `${f.name} ${sqlStyleSchema(f)}`)
      .join(", ");
    res = `STRUCT<${innerSchema}>`;
  }

  if (schema.mode === "REPEATED") {
    res = `ARRAY<${res}>`;
  }

  return res;
}

const simpleIdentRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
export function quoteIfComplexIdentifier(ident: string): string {
  if (ident.match(simpleIdentRegex)) {
    return ident;
  } else {
    return "`" + ident + "`";
  }
}

export function stripStringLiteral(str: string): string {
  if (str.startsWith("'''") || str.startsWith('"""')) {
    return str.slice(3, -3);
  } else if (str.startsWith("'") || str.startsWith('"')) {
    return str.slice(1, -1);
  } else {
    return ""; // can't be
  }
}
