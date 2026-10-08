import type { Disposable } from 'vscode';
import type { AssetRequest, AssetViewEntry } from './protocol';
import type { AssetRecord } from './service';

export interface AssetProvider extends Disposable {
  type: string;
  label: string;
  configure(previous?: AssetRecord): Promise<boolean>;
  toViewEntry(asset: AssetRecord): AssetViewEntry;
  execute(asset: AssetRecord, request: AssetRequest): Promise<void>;
  invalidate(id?: string): void;
}
