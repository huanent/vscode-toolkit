import type { AssetsMessage } from '@/features/assets/protocol';
import type { TempFilesWebviewMessage } from '@/features/temp/protocol';
import type { DashboardData } from '@/shared/dashboard-protocol';
import { useHostData } from '@/webview/utils/host-data';

export function useDashboardState() {
  const state = useHostData<DashboardData, TempFilesWebviewMessage | AssetsMessage>((message, previous) => {
    if (message.type === 'tempFilesUpdated' && previous.status === 'loaded') {
      return { status: 'loaded', data: { ...previous.data, temp: message.entries } };
    }
    if (message.type === 'assetsUpdated' && previous.status === 'loaded') {
      return { status: 'loaded', data: { ...previous.data, assets: message.entries } };
    }
    if (message.type === 'tempFileError' || message.type === 'assetError') {
      return previous.status === 'loaded'
        ? { ...previous, error: message.message }
        : { status: 'error', message: message.message };
    }
    return undefined;
  });

  return {
    tempEntries: state.status === 'loaded' ? state.data.temp : undefined,
    assets: state.status === 'loaded' ? state.data.assets : undefined,
    error: state.status === 'loaded' ? state.error : state.status === 'error' ? state.message : undefined,
    loading: state.status === 'loading',
  };
}