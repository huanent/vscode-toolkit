import { useState } from 'react';
import { TabPanel, Tabs, type Tab } from '@/webview/components/tabs';
import { Icon } from '@/webview/components/icons';
import { Empty } from '@/webview/components/empty';
import { mountWebview } from '@/webview/bootstrap';
import { TempPanel } from '@/webview/pages/dashboard/components/temp-panel';
import { AssetsPanel } from '@/webview/pages/dashboard/components/assets-panel';
import { useTempState } from './use-temp-state';
import '@/webview/styles.css';

const tabs: Tab[] = [
  { id: 'workflow', label: 'Workflow', icon: <Icon name="debug-line-by-line" size="md" /> },
  { id: 'assets', label: 'Assets', icon: <Icon name="layers" size="md" /> },
  { id: 'temp', label: 'Temp', icon: <Icon name="history" size="md" /> },
];

function App() {
  const [activeTabId, setActiveTabId] = useState('workflow');
  const tempState = useTempState();

  return (
    <main className="flex h-screen flex-col overflow-hidden px-1">
      <Tabs
        tabs={tabs}
        activeTabId={activeTabId}
        onChange={setActiveTabId}
        className="min-h-0 flex-1"
        contentClassName="min-h-0 flex-1"
      >
        <div className="h-full overflow-auto py-2">
          <TabPanel tabId="workflow">
            <Empty
              label="Empty workflow"
              title="No workflow yet"
              description="Create a workflow to see it here."
              icon="debug-line-by-line"
            />
          </TabPanel>

          <TabPanel tabId="assets" className="h-full">
            <AssetsPanel entries={tempState.assets} error={tempState.error} loading={tempState.loading} />
          </TabPanel>

          <TabPanel tabId="temp" className="h-full">
            <TempPanel entries={tempState.entries} error={tempState.error} loading={tempState.loading} />
          </TabPanel>
        </div>
      </Tabs>
    </main>
  );
}

mountWebview('root', <App />);
