import { Token, UnknownNode } from "@dr666m1/bq2cst";
import * as LSP from "vscode-languageserver/node";

type DocumentInfo = {
  text: string;
  tokens: Token[];
  cst: UnknownNode[];
};

export function breakdownTokens(tokens: Token[]) {
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

export function getTokenRangeByRowColumn(
  docInfo: DocumentInfo,
  row: number,
  column: number
): LSP.Range {
  // row, column... 1-based index

  // start position
  const start = { line: row - 1, character: column - 1 };

  // end position
  const token = getTokenByRowColumn(docInfo, row, column);
  const splittedLiteral = token.literal.split("\n");
  let endLine
  let endChacter
  if (splittedLiteral.length === 1) {
    endLine = start.line
    endChacter = start.character + splittedLiteral[splittedLiteral.length - 1].length
  } else {
    endLine = start.line + splittedLiteral.length - 1
    endChacter = splittedLiteral[splittedLiteral.length - 1].length
  }
  const end = {
    line: endLine,
    character: endChacter,
  };

  return { start: start, end: end };
}

export function getPositionByRowColumn(
  docInfo: DocumentInfo,
  row: number,
  column: number
) {
  // row, column... 1-based index
  const rowLengthArr = docInfo.text.split("\n").map((x) => x.length + 1); // add length of "\n"
  const position =
    rowLengthArr.slice(0, row - 1).reduce((x, y) => x + y, 0) + (column - 1);
  return position;
}

export function getTokenByRowColumn(
  docInfo: DocumentInfo,
  row: number,
  column: number
) {
  // row, column... 1-based index
  const targetPosition = getPositionByRowColumn(docInfo, row, column);
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
