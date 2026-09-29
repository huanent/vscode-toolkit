import { useEffect, useState } from 'react';
import { TabPanel, Tabs, type Tab } from '@/webview/components/tabs';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { mountWebview } from '@/webview/bootstrap';
import { TempPanel } from '@/webview/pages/dashboard/components/temp-panel';
import { ToolList } from '@/webview/pages/dashboard/components/tool-list';
import { tools } from '@/webview/pages/dashboard/model/tools';
import type { TempFilesWebviewMessage, TempTreeEntry } from '@/features/temp/protocol';
import { useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

const tabs: Tab[] = [
  { id: 'tools', label: 'Tools', icon: <Icon name="tools" size="sm" /> },
  { id: 'overview', label: 'Overview', icon: <Icon name="dashboard" size="sm" /> },
  { id: 'temp', label: 'Temp', icon: <Icon name="history" size="sm" /> },
];

function App() {
  const [activeTabId, setActiveTabId] = useState('tools');
  const [activeToolId, setActiveToolId] = useState('command-palette');
  const tempState = useHostData<TempTreeEntry[]>();
  const [tempEntries, setTempEntries] = useState<TempTreeEntry[]>();
  const [tempError, setTempError] = useState<string>();
  const activeTool = tools.find((tool) => tool.id === activeToolId) ?? tools[0];

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
        <TabPanel tabId="tools" activeTabId={activeTabId}>
          <section
            className="mb-5 flex items-end justify-between gap-4 border border-(--vscode-panel-border) bg-(--vscode-editor-background)/75 p-4"
            aria-labelledby="focus-title"
          >
            <div>
              <span className="text-xs font-bold tracking-widest text-(--vscode-textLink-foreground)">
                CURRENT FOCUS
              </span>
              <h2 id="focus-title" className="mt-2 mb-1 text-base font-semibold">
                {activeTool.name}
              </h2>
              <p className="text-(--vscode-descriptionForeground)">Choose a tool below to make this space yours.</p>
            </div>
            <Button onClick={() => setActiveToolId('command-palette')}>Open tool</Button>
          </section>

          <ToolList activeToolId={activeTool.id} onSelect={setActiveToolId} />
        </TabPanel>

        <TabPanel tabId="overview" activeTabId={activeTabId}>
          <section className="grid gap-4 border border-(--vscode-panel-border) bg-(--vscode-editor-background)/75 p-4">
            <div>
              <span className="text-xs font-bold tracking-widest text-(--vscode-textLink-foreground)">
                WORKSPACE SNAPSHOT
              </span>
              <h2 className="mt-2 mb-1 text-base font-semibold">Everything in one quiet place.</h2>
              <p className="text-(--vscode-descriptionForeground)">Your toolkit is ready for the next small action.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ['Available tools', tools.length.toString()],
                ['Active tool', activeTool.name],
                ['Workspace status', 'Ready'],
              ].map(([label, value]) => (
                <div className="border border-(--vscode-panel-border) p-3" key={label}>
                  <p className="mb-2 text-xs text-(--vscode-descriptionForeground)">{label}</p>
                  <strong className="text-sm">{value}</strong>
                </div>
              ))}
            </div>
          </section>
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
