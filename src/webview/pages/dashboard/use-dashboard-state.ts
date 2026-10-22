import { useEffect, useEffectEvent, useState } from 'react';
import type { AssetsMessage } from '@/features/assets/protocol';
import type { TempFilesWebviewMessage } from '@/features/temp/protocol';
import type { PlaybookFilesWebviewMessage } from '@/features/playbook/protocol';
import type { CollapseDashboardTreeMessage, DashboardData } from '@/shared/dashboard-protocol';
import { useHostData } from '@/webview/utils/host-data';

export function useDashboardState(activeTabId: string) {
  const [collapseAllTriggers, setCollapseAllTriggers] = useState<Record<string, number>>({});
  const onCollapseActiveTree = useEffectEvent((event: MessageEvent<CollapseDashboardTreeMessage>) => {
    if (event.data?.type !== 'collapseActiveTree') return;
    setCollapseAllTriggers((current) => ({
      ...current,
      [activeTabId]: (current[activeTabId] ?? 0) + 1,
    }));
  });

  useEffect(() => {
    window.addEventListener('message', onCollapseActiveTree);
    return () => window.removeEventListener('message', onCollapseActiveTree);
  }, []);

  const state = useHostData<
    DashboardData,
    TempFilesWebviewMessage | AssetsMessage | PlaybookFilesWebviewMessage | CollapseDashboardTreeMessage
  >((message, previous) => {
    if (message.type === 'tempFilesUpdated' && previous.status === 'loaded') {
      return { status: 'loaded', data: { ...previous.data, temp: message.entries } };
    }
    if (message.type === 'playbookFilesUpdated' && previous.status === 'loaded') {
      return { status: 'loaded', data: { ...previous.data, playbook: message.entries } };
    }
    if (message.type === 'assetsUpdated' && previous.status === 'loaded') {
      return { status: 'loaded', data: { ...previous.data, assets: message.entries } };
    }
    if (message.type === 'tempFileError' || message.type === 'assetError' || message.type === 'playbookFileError') {
      return previous.status === 'loaded'
        ? { ...previous, error: message.message }
        : { status: 'error', message: message.message };
    }
    return undefined;
  });

  return {
    tempEntries: state.status === 'loaded' ? state.data.temp : undefined,
    playbookEntries: state.status === 'loaded' ? state.data.playbook : undefined,
    assets: state.status === 'loaded' ? state.data.assets : undefined,
    collapseAllTriggers,
    error: state.status === 'loaded' ? state.error : state.status === 'error' ? state.message : undefined,
    loading: state.status === 'loading',
  };
}
