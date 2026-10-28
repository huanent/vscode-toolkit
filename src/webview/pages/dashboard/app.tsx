import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { TabPanel, Tabs, type Tab } from '@/webview/components/ui/tabs';
import { Icon } from '@/webview/components/ui/icons';
import { Input } from '@/webview/components/ui/input';
import type {
  DashboardSearchRequest,
  DashboardSearchResult,
  SearchDashboardTreeMessage,
} from '@/shared/dashboard-protocol';
import { postToHost } from '@/webview/utils/host-data';
import { mountWebview } from '@/webview/bootstrap';
import { TempPanel } from '@/webview/pages/dashboard/components/temp-panel';
import { PlaybookPanel } from '@/webview/pages/dashboard/components/playbook-panel';
import { AssetsPanel } from '@/webview/pages/dashboard/components/assets-panel';
import { useDashboardState } from './use-dashboard-state';
import '@/webview/styles.css';

const tabs: Tab[] = [
  {
    id: 'assets',
    label: 'Assets',
    icon: <Icon name="layers" size="lg" />,
    context: { webviewSection: 'assets', preventDefaultContextMenuItems: true },
  },
  {
    id: 'playbook',
    label: 'Playbooks',
    icon: <Icon name="run-coverage" size="lg" />,
    context: { webviewSection: 'playbook', preventDefaultContextMenuItems: true },
  },

  {
    id: 'temp',
    label: 'Temp',
    icon: <Icon name="history" size="lg" />,
    context: { webviewSection: 'temp', preventDefaultContextMenuItems: true },
  },
];

function App() {
  const [activeTabId, setActiveTabId] = useState('assets');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searches, setSearches] = useState<Record<string, string>>({});
  const [searchMatches, setSearchMatches] = useState<string[]>([]);
  const [searchError, setSearchError] = useState('');
  const requestId = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const dashboardState = useDashboardState(activeTabId);
  const onSearch = useEffectEvent((event: MessageEvent<SearchDashboardTreeMessage>) => {
    if (event.data?.type !== 'searchActiveTree') return;
    setSearchOpen(true);
    searchRef.current?.focus();
  });
  useEffect(() => {
    window.addEventListener('message', onSearch);
    return () => window.removeEventListener('message', onSearch);
  }, []);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen, activeTabId]);
  useEffect(() => {
    const currentRequest = ++requestId.current;
    setSearchMatches([]);
    setSearchError('');
    const query = searches[activeTabId] ?? '';
    if (!searchOpen || !query.trim()) return;
    const timer = setTimeout(() => {
      postToHost({
        type: 'searchDashboardContents',
        tab: activeTabId as DashboardSearchRequest['tab'],
        query,
        requestId: currentRequest,
      } satisfies DashboardSearchRequest);
    }, 200);
    return () => clearTimeout(timer);
  }, [
    activeTabId,
    searches,
    searchOpen,
    dashboardState.assets,
    dashboardState.playbookEntries,
    dashboardState.tempEntries,
  ]);
  useEffect(() => {
    const onResult = (event: MessageEvent<DashboardSearchResult>) => {
      if (event.data?.requestId !== requestId.current) return;
      if (event.data.type === 'dashboardSearchResult') setSearchMatches(event.data.matches);
      else if (event.data.type === 'dashboardSearchError') setSearchError(event.data.message);
    };
    window.addEventListener('message', onResult);
    return () => window.removeEventListener('message', onResult);
  }, []);

  return (
    <main className="flex h-screen flex-col overflow-hidden px-1">
      <Tabs
        tabs={tabs}
        activeTabId={activeTabId}
        onChange={setActiveTabId}
        className="min-h-0 flex-1"
        contentClassName="flex min-h-0 flex-1 flex-col"
      >
        {searchOpen && (
          <div className="pt-2">
            <Input
              ref={searchRef}
              type="search"
              aria-label="Search current tab"
              placeholder="Search..."
              value={searches[activeTabId] ?? ''}
              onChange={(event) => setSearches((current) => ({ ...current, [activeTabId]: event.target.value }))}
              onBlur={(event) => {
                if (!event.currentTarget.value) {
                  setSearches({});
                  setSearchOpen(false);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSearches({});
                  setSearchOpen(false);
                }
              }}
            />
            {searchError && (
              <div role="alert" className="text-(--vscode-errorForeground)">
                {searchError}
              </div>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto py-2">
          <TabPanel tabId="playbook" className="h-full" keepMounted>
            <PlaybookPanel
              entries={dashboardState.playbookEntries}
              error={dashboardState.error}
              loading={dashboardState.loading}
              collapseAllTrigger={dashboardState.collapseAllTriggers.playbook ?? 0}
              search={searches.playbook}
              searchMatches={activeTabId === 'playbook' ? searchMatches : []}
            />
          </TabPanel>

          <TabPanel tabId="assets" className="h-full" keepMounted>
            <AssetsPanel
              entries={dashboardState.assets}
              error={dashboardState.error}
              loading={dashboardState.loading}
              collapseAllTrigger={dashboardState.collapseAllTriggers.assets ?? 0}
              search={searches.assets}
              searchMatches={activeTabId === 'assets' ? searchMatches : []}
            />
          </TabPanel>

          <TabPanel tabId="temp" className="h-full" keepMounted>
            <TempPanel
              entries={dashboardState.tempEntries}
              error={dashboardState.error}
              loading={dashboardState.loading}
              collapseAllTrigger={dashboardState.collapseAllTriggers.temp ?? 0}
              search={searches.temp}
              searchMatches={activeTabId === 'temp' ? searchMatches : []}
            />
          </TabPanel>
        </div>
      </Tabs>
    </main>
  );
}

mountWebview('root', <App />);
