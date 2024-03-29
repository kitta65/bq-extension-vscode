import * as vscode from "vscode";
import * as path from "path";
import { execSync } from "child_process";

export const project =
  process.env.CI === "true"
    ? "bq-extension-vscode"
    : (execSync("gcloud config get-value project") + "").trim();

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function focusOnTextDocument(docPath: string) {
  const editor = await vscode.workspace
    .openTextDocument(getDocUri(docPath))
    .then((doc) => vscode.window.showTextDocument(doc));
  return editor;
}

export async function createTextDocument(docPath: string) {
  const edit = new vscode.WorkspaceEdit();
  edit.createFile(getDocUri(docPath));
  await vscode.workspace.applyEdit(edit);
  await focusOnTextDocument(docPath);
}

export async function deleteTextDocument(docPath: string) {
  const edit = new vscode.WorkspaceEdit();
  edit.deleteFile(getDocUri(docPath));
  await vscode.workspace.applyEdit(edit);
}

export async function insert(
  docPath: string,
  position: vscode.Position,
  text: string,
) {
  const edit = new vscode.WorkspaceEdit();
  edit.insert(getDocUri(docPath), position, text);
  await vscode.workspace.applyEdit(edit);
}

export function getDocUri(docPath: string) {
  const absDocPath = path.resolve(__dirname, "../../testFixture", docPath);
  const uri = vscode.Uri.file(absDocPath);
  return uri;
}
