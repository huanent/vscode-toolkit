import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readSpreadsheet, validateSpreadsheetUri } from './service';

vi.mock('vscode', () => ({
  workspace: { fs: { readFile: vi.fn<(uri: vscode.Uri) => Promise<Uint8Array>>() } },
}));

const readFile = vi.mocked(vscode.workspace.fs.readFile);

describe('spreadsheet reader', () => {
  beforeEach(() => readFile.mockReset());

  it.each(['xlsx', 'XLSX', 'csv', 'CSV'])('accepts %s files', (extension) => {
    expect(() => validateSpreadsheetUri({ path: `/sample.${extension}` } as vscode.Uri)).not.toThrow();
  });

  it('rejects unsupported spreadsheet formats', () => {
    expect(() => validateSpreadsheetUri({ path: '/sample.xls' } as vscode.Uri)).toThrow('Only XLSX and CSV');
  });

  it('reads worksheet names, dimensions, and formatted cell text from XLSX', async () => {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Report').addRows([
      ['Name', 'Value'],
      ['Ada', 42],
    ]);
    readFile.mockResolvedValue(new Uint8Array(await workbook.xlsx.writeBuffer()));

    await expect(readSpreadsheet({ path: '/sample.xlsx' } as vscode.Uri)).resolves.toEqual([
      {
        name: 'Report',
        rows: [
          ['Name', 'Value'],
          ['Ada', '42'],
        ],
        rowCount: 2,
        columnCount: 2,
      },
    ]);
  });

  it('parses CSV files as a single worksheet', async () => {
    readFile.mockResolvedValue(new TextEncoder().encode('Name,Value\r\nAda,42'));

    await expect(readSpreadsheet({ path: '/sample.csv' } as vscode.Uri)).resolves.toEqual([
      {
        name: 'sheet1',
        rows: [
          ['Name', 'Value'],
          ['Ada', '42'],
        ],
        rowCount: 2,
        columnCount: 2,
      },
    ]);
  });
});
