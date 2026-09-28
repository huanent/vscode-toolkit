import { Empty } from '@/webview/components/empty';
import { PageShell } from '@/webview/components/page-shell';
import { mountWebview } from '@/webview/bootstrap';
import '@/webview/styles.css';

function App() {
  return (
    <PageShell>
      <Empty
        label="No results"
        title="No results yet"
        description="Run a tool from Toolkit and its output will appear here."
        icon="↗"
      />
    </PageShell>
  );
}

mountWebview('root', <App />);
