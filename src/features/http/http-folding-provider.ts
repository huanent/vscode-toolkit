import * as vscode from 'vscode';

const separatorRegex = /^\s*###+/;

export class HttpFoldingRangeProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[] {
    const ranges: vscode.FoldingRange[] = [];
    const lineCount = document.lineCount;

    let sectionStartLine: number | null = null;

    for (let i = 0; i < lineCount; i++) {
      const lineText = document.lineAt(i).text;
      if (separatorRegex.test(lineText)) {
        if (sectionStartLine !== null && i - 1 > sectionStartLine) {
          ranges.push(new vscode.FoldingRange(sectionStartLine, i - 1, vscode.FoldingRangeKind.Region));
        }
        sectionStartLine = i;
      }
    }

    if (sectionStartLine !== null && lineCount - 1 > sectionStartLine) {
      ranges.push(new vscode.FoldingRange(sectionStartLine, lineCount - 1, vscode.FoldingRangeKind.Region));
    }

    return ranges;
  }
}
