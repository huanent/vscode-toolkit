import { Empty } from '@/webview/components/empty';
import { mountWebview } from '@/webview/bootstrap';
import '@/webview/styles.css';

function App() {
  return (
    <main>
      <Empty
        label="No results"
        title="No results yet"
        description="Run a tool from Toolkit and its output will appear here."
        icon="↗"
      />
    </main>
  );
}

mountWebview('root', <App />);
