import type { Disposable } from 'vscode';
import type { AssetFormValues, AssetRequest, AssetViewEntry } from './protocol';
import type { AssetRecord } from './service';

export interface AssetProvider extends Disposable {
  type: string;
  label: string;
  getFormValues(previous?: AssetRecord): AssetFormValues;
  saveConfiguration(values: AssetFormValues, previous?: AssetRecord, parentId?: string): Promise<void>;
  toViewEntry(asset: AssetRecord): AssetViewEntry;
  execute(asset: AssetRecord, request: AssetRequest): Promise<void>;
  invalidate(id?: string): void;
}
