import { useState } from 'react';
import { PageShell } from '@/webview/components/page-shell';
import { TabPanel, Tabs, type Tab } from '@/webview/components/tabs';
import { mountWebview } from '@/webview/bootstrap';
import { ToolList } from '@/webview/pages/dashboard/components/tool-list';
import { tools } from '@/webview/pages/dashboard/model/tools';
import '@/webview/styles.css';

const tabs: Tab[] = [
  { id: 'tools', label: 'Tools', icon: '⌘' },
  { id: 'overview', label: 'Overview', icon: '◌' },
];

function App() {
  const [activeTabId, setActiveTabId] = useState('tools');
  const [activeToolId, setActiveToolId] = useState('command-palette');
  const activeTool = tools.find((tool) => tool.id === activeToolId) ?? tools[0];

  return (
    <PageShell>
      <Tabs tabs={tabs} activeTabId={activeTabId} onChange={setActiveTabId} />

      <div className="pt-5">
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
            <button
              className="shrink-0 cursor-pointer border-0 bg-(--vscode-button-background) px-3 py-2 text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)"
              type="button"
              onClick={() => setActiveToolId('command-palette')}
            >
              Open tool
            </button>
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
      </div>
    </PageShell>
  );
}

mountWebview('root', <App />);
