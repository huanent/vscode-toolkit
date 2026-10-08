import type { TempFilesWebviewMessage, TempTreeEntry } from '@/features/temp/protocol';
import { useHostData } from '@/webview/utils/host-data';

export function useTempState() {
  const state = useHostData<TempTreeEntry[], TempFilesWebviewMessage>((message, previous) => {
    if (message.type === 'tempFilesUpdated') return { status: 'loaded', data: message.entries };
    if (message.type === 'tempFileError') {
      return previous.status === 'loaded'
        ? { ...previous, error: message.message }
        : { status: 'error', message: message.message };
    }
    return undefined;
  });

  return {
    entries: state.status === 'loaded' ? state.data : undefined,
    error: state.status === 'loaded' ? state.error : state.status === 'error' ? state.message : undefined,
    loading: state.status === 'loading',
  };
}
