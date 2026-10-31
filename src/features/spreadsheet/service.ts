import type { Cell } from 'exceljs';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import * as vscode from 'vscode';
import * as yauzl from 'yauzl';
import type { SpreadsheetSheet } from './protocol';

const maxPreviewColumns = 100;
const maxPreviewRows = 500;
const maxFileBytes = 20 * 1024 * 1024;
const maxUncompressedBytes = 100 * 1024 * 1024;
const maxArchiveEntries = 2000;

export function validateSpreadsheetUri(uri: vscode.Uri): void {
  if (!['.xlsx', '.csv'].includes(path.posix.extname(uri.path).toLowerCase())) {
    throw new Error('Only XLSX and CSV files can be previewed.');
  }
}

export async function readSpreadsheet(uri: vscode.Uri): Promise<SpreadsheetSheet[]> {
  validateSpreadsheetUri(uri);
  const metadata = await vscode.workspace.fs.stat(uri);
  if (metadata.size > maxFileBytes) throw new Error('Spreadsheet preview supports files up to 20 MB.');
  const data = await vscode.workspace.fs.readFile(uri);
  if (data.byteLength > maxFileBytes) throw new Error('Spreadsheet preview supports files up to 20 MB.');
  if (uri.path.toLowerCase().endsWith('.xlsx')) await validateWorkbookSize(Buffer.from(data));
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  if (uri.path.toLowerCase().endsWith('.csv')) {
    await workbook.csv.read(Readable.from([data]));
  } else {
    const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength) as unknown as Parameters<
      typeof workbook.xlsx.load
    >[0];
    await workbook.xlsx.load(buffer);
  }

  return workbook.worksheets.map((worksheet) => {
    const rowCount = worksheet.rowCount;
    const columnCount = worksheet.columnCount;
    const rows: string[][] = [];
    const previewColumnCount = Math.min(columnCount, maxPreviewColumns);
    for (let rowNumber = 1; rowNumber <= Math.min(rowCount, maxPreviewRows); rowNumber += 1) {
      const row: string[] = [];
      for (let columnNumber = 1; columnNumber <= previewColumnCount; columnNumber += 1) {
        row.push(formatCell(worksheet.getRow(rowNumber).getCell(columnNumber)));
      }
      rows.push(row);
    }
    return {
      name: worksheet.name,
      rows,
      rowCount,
      columnCount,
      truncated: rowCount > maxPreviewRows || columnCount > maxPreviewColumns,
    };
  });
}

async function validateWorkbookSize(data: Buffer): Promise<void> {
  const zip = await yauzl.fromBufferPromise(data, { validateEntrySizes: true });
  try {
    let total = 0;
    let count = 0;
    for await (const entry of zip.eachEntry()) {
      total += entry.uncompressedSize;
      count++;
      if (total > maxUncompressedBytes || count > maxArchiveEntries) {
        throw new Error(
          'Spreadsheet preview supports XLSX files with up to 100 MB of uncompressed data and 2000 entries.',
        );
      }
    }
  } finally {
    zip.close();
  }
}

function formatCell(cell: Cell): string {
  const { value } = cell;
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleString();
  try {
    return cell.text;
  } catch {
    return typeof value === 'object' ? '' : String(value);
  }
}
