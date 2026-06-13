import { EditorCanvas } from './components/EditorCanvas';
import { ExportPanel } from './components/ExportPanel';
import { ImageQueue } from './components/ImageQueue';
import { TopBar } from './components/TopBar';

export function App() {
  return (
    <div className="app-shell">
      <TopBar />
      <div className="workspace">
        <ImageQueue />
        <EditorCanvas />
        <ExportPanel />
      </div>
    </div>
  );
}
