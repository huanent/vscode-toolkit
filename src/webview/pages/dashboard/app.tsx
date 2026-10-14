import { useState } from 'react';
import { TabPanel, Tabs, type Tab } from '@/webview/components/tabs';
import { Icon } from '@/webview/components/icons';
import { mountWebview } from '@/webview/bootstrap';
import { TempPanel } from '@/webview/pages/dashboard/components/temp-panel';
import { WorkflowPanel } from '@/webview/pages/dashboard/components/workflow-panel';
import { AssetsPanel } from '@/webview/pages/dashboard/components/assets-panel';
import { useDashboardState } from './use-dashboard-state';
import '@/webview/styles.css';

const tabs: Tab[] = [
  {
    id: 'workflow',
    label: 'Workflow',
    icon: <Icon name="debug-line-by-line" size="lg" />,
    context: { webviewSection: 'workflow', preventDefaultContextMenuItems: true },
  },
  {
    id: 'assets',
    label: 'Assets',
    icon: <Icon name="layers" size="lg" />,
    context: { webviewSection: 'assets', preventDefaultContextMenuItems: true },
  },
  {
    id: 'temp',
    label: 'Temp',
    icon: <Icon name="history" size="lg" />,
    context: { webviewSection: 'temp', preventDefaultContextMenuItems: true },
  },
];

function App() {
  const [activeTabId, setActiveTabId] = useState('workflow');
  const dashboardState = useDashboardState(activeTabId);

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
          <TabPanel tabId="workflow" className="h-full" keepMounted>
            <WorkflowPanel
              entries={dashboardState.workflowEntries}
              error={dashboardState.error}
              loading={dashboardState.loading}
              collapseAllTrigger={dashboardState.collapseAllTriggers.workflow ?? 0}
            />
          </TabPanel>

          <TabPanel tabId="assets" className="h-full" keepMounted>
            <AssetsPanel
              entries={dashboardState.assets}
              error={dashboardState.error}
              loading={dashboardState.loading}
              collapseAllTrigger={dashboardState.collapseAllTriggers.assets ?? 0}
            />
          </TabPanel>

          <TabPanel tabId="temp" className="h-full" keepMounted>
            <TempPanel
              entries={dashboardState.tempEntries}
              error={dashboardState.error}
              loading={dashboardState.loading}
              collapseAllTrigger={dashboardState.collapseAllTriggers.temp ?? 0}
            />
          </TabPanel>
        </div>
      </Tabs>
    </main>
  );
}

mountWebview('root', <App />);
