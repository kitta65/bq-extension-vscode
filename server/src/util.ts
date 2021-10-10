import * as bq2cst from "@dr666m1/bq2cst";
import * as LSP from "vscode-languageserver/node";

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

function getFirstNode(node: bq2cst.UnknownNode): bq2cst.UnknownNode {
  const candidates = [];
  for (const [_, v] of Object.entries(node.children)) {
    if (isNodeChild(v)) {
      candidates.push(getFirstNode(v.Node));
    } else if (isNodeVecChild(v)) {
      // NOTE maybe you don't have to check 2nd, 3rd, or latter node
      v.NodeVec.forEach((x) => candidates.push(getFirstNode(x)));
    }
  }
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
  const candidates = [];
  for (const [_, v] of Object.entries(node.children)) {
    if (isNodeChild(v)) {
      candidates.push(getLastNode(v.Node));
    } else if (isNodeVecChild(v)) {
      // NOTE maybe you don't have to check 2nd, 3rd, or latter node
      v.NodeVec.forEach((x) => candidates.push(getLastNode(x)));
    }
  }
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
  column: number
): LSP.Range {
  // line, column... 1-based index

  // start position
  const start = { line: line - 1, character: column - 1 };

  // end position
  const token = getTokenByRowColumn(docInfo, line, column);
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
  column: number
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
  column: number
) {
  // line, column... 1-based index
  const targetPosition = getPositionByRowColumn(docInfo, line, column);
  let res = docInfo.tokens[docInfo.tokens.length - 1];
  for (let i = 1; i < docInfo.tokens.length; i++) {
    const token = docInfo.tokens[i];
    const tokenPosition = getPositionByRowColumn(
      docInfo,
      token.line,
      token.column
    );
    if (targetPosition < tokenPosition) {
      res = docInfo.tokens[i - 1];
      break;
    }
  }
  return res;
}

export function parseType(str: string) {
  let depth = 0;
  let start = 0;
  const res: string[] = [];
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "<") {
      depth += 1;
    } else if (str[i] === ">") {
      depth -= 1;
    } else if (str[i] === "," && depth === 0) {
      res.push(str.substring(start, i));
      start = i + 1;
    }
  }
  res.push(str.substring(start)); // last item
  return res.map((x) => x.trim());
}

export function positionBetween(
  position: LSP.Position,
  start: LSP.Position,
  end: LSP.Position
) {
  if (position.line < start.line) return false;
  if (position.line === start.line && position.character < start.character)
    return false;
  if (end.line < position.line) return false;
  if (position.line === end.line && end.character < position.character)
    return false;
  return true;
}
