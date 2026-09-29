import { useEffect, useState } from 'react';
import { TabPanel, Tabs, type Tab } from '@/webview/components/tabs';
import { Icon } from '@/webview/components/icons';
import { mountWebview } from '@/webview/bootstrap';
import { TempPanel } from '@/webview/pages/dashboard/components/temp-panel';
import type { TempFilesWebviewMessage, TempTreeEntry } from '@/features/temp/protocol';
import { useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

const tabs: Tab[] = [
  { id: 'workflow', label: 'Workflow', icon: <Icon name="worktree" size="sm" /> },
  { id: 'assets', label: 'Assets', icon: <Icon name="layers" size="sm" /> },
  { id: 'temp', label: 'Temp', icon: <Icon name="history" size="sm" /> },
];

function App() {
  const [activeTabId, setActiveTabId] = useState('workflow');
  const tempState = useHostData<TempTreeEntry[]>();
  const [tempEntries, setTempEntries] = useState<TempTreeEntry[]>();
  const [tempError, setTempError] = useState<string>();

  useEffect(() => {
    const onMessage = (event: MessageEvent<TempFilesWebviewMessage>) => {
      if (event.data?.type === 'tempFilesUpdated') {
        setTempEntries(event.data.entries);
        setTempError(undefined);
      } else if (event.data?.type === 'tempFileError') {
        setTempError(event.data.message);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const displayedTempEntries = tempEntries ?? (tempState.status === 'loaded' ? tempState.data : undefined);
  const displayedTempError =
    tempError ?? (tempEntries === undefined && tempState.status === 'error' ? tempState.message : undefined);

  return (
    <main className="px-1">
      <div>
        <Tabs tabs={tabs} activeTabId={activeTabId} onChange={setActiveTabId} />
      </div>
      <div className="py-2">
        <TabPanel tabId="workflow" activeTabId={activeTabId}>
          <></>
        </TabPanel>

        <TabPanel tabId="assets" activeTabId={activeTabId}>
          <></>
        </TabPanel>

        <TabPanel tabId="temp" activeTabId={activeTabId}>
          <TempPanel
            entries={displayedTempEntries}
            error={displayedTempError}
            loading={tempState.status === 'loading' && tempEntries === undefined}
          />
        </TabPanel>
      </div>
    </main>
  );
}

mountWebview('root', <App />);
