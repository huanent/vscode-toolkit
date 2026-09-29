import { useEffect, useState } from 'react';
import { TabPanel, Tabs, type Tab } from '@/webview/components/tabs';
import { Icon } from '@/webview/components/icons';
import { Empty } from '@/webview/components/empty';
import { mountWebview } from '@/webview/bootstrap';
import { TempPanel } from '@/webview/pages/dashboard/components/temp-panel';
import type { TempFilesWebviewMessage, TempTreeEntry } from '@/features/temp/protocol';
import { useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

const tabs: Tab[] = [
  { id: 'workflow', label: 'Workflow', icon: <Icon name="debug-line-by-line" size="md" /> },
  { id: 'assets', label: 'Assets', icon: <Icon name="layers" size="md" /> },
  { id: 'temp', label: 'Temp', icon: <Icon name="history" size="md" /> },
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
      <Tabs tabs={tabs} activeTabId={activeTabId} onChange={setActiveTabId}>
        <div className="py-2">
          <TabPanel tabId="workflow">
            <Empty
              label="Empty workflow"
              title="No workflow yet"
              description="Create a workflow to see it here."
              icon="debug-line-by-line"
            />
          </TabPanel>

          <TabPanel tabId="assets">
            <Empty
              label="Empty assets"
              title="No assets yet"
              description="Assets added to Toolkit will appear here."
              icon="layers"
            />
          </TabPanel>

          <TabPanel tabId="temp">
            <TempPanel
              entries={displayedTempEntries}
              error={displayedTempError}
              loading={tempState.status === 'loading' && tempEntries === undefined}
            />
          </TabPanel>
        </div>
      </Tabs>
    </main>
  );
}

mountWebview('root', <App />);
