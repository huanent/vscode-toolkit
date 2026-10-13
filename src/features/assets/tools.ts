import * as vscode from 'vscode';
import { isAiEnabled, type AssetService } from './service';

interface SearchAssetsInput {
  keyword: string;
}

export function registerAssetTools(assets: AssetService): vscode.Disposable {
  return vscode.lm.registerTool<SearchAssetsInput>('assetsSearch', {
    async invoke({ input }) {
      const keyword = input.keyword.trim().toLowerCase();
      if (!keyword) throw new Error('Enter an asset search keyword.');

      const matches = (await assets.list()).filter(isAiEnabled).filter((asset) => {
        const record = asset as typeof asset & { host?: unknown; port?: unknown; database?: unknown };
        return [record.id, record.type, record.name, record.folder, record.host, record.port, record.database].some(
          (value) =>
            (typeof value === 'string' || typeof value === 'number') && String(value).toLowerCase().includes(keyword),
        );
      });
      const limit = 100;
      const results = matches.slice(0, limit).map((asset) => {
        const record = asset as typeof asset & { host?: unknown; port?: unknown; database?: unknown };
        return {
          id: record.id,
          type: record.type,
          name: record.name,
          ...(record.folder ? { folder: record.folder } : {}),
          ...(typeof record.host === 'string' ? { host: record.host } : {}),
          ...(typeof record.port === 'number' ? { port: record.port } : {}),
          ...(typeof record.database === 'string' ? { database: record.database } : {}),
        };
      });

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          JSON.stringify({ assets: results, totalMatches: matches.length, truncated: matches.length > limit }),
        ),
      ]);
    },
  });
}
