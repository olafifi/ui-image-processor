# UI Image Processor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a GitHub Pages deployable, browser-local UI image processing tool with multi-image import, WebP support, canvas editing, crop/export, templates, CSV rename flow, and ZIP export.

**Architecture:** Use a Vite + React + TypeScript single-page app. Keep pure image and CSV logic in testable TypeScript modules, and keep React components focused on orchestration and UI state. SAM is implemented as a capability-aware adapter with WebGPU detection and graceful fallback; the first working build must keep manual editing and export functional even when SAM is unavailable.

**Tech Stack:** Vite, React, TypeScript, Vitest, React Testing Library, Playwright, Canvas 2D, IndexedDB wrapper, PapaParse, JSZip, GitHub Pages static deployment.

---

## File Structure

- Create `package.json`: scripts and dependencies.
- Create `index.html`: Vite entry.
- Create `vite.config.ts`: React, test, and GitHub Pages base config.
- Create `tsconfig.json`, `tsconfig.node.json`: TypeScript config.
- Create `playwright.config.ts`: browser smoke tests.
- Create `src/main.tsx`: React entry.
- Create `src/App.tsx`: app shell and workflow orchestration.
- Create `src/styles.css`: V6-inspired professional tool UI.
- Create `src/types.ts`: shared data model.
- Create `src/lib/fileImport.ts`: file filtering and image decoding.
- Create `src/lib/canvasExport.ts`: crop, background, round corners, PNG/JPG export.
- Create `src/lib/csvRename.ts`: CSV template generation, parsing, and validation.
- Create `src/lib/templateStore.ts`: local template persistence.
- Create `src/lib/zipExport.ts`: batch ZIP generation.
- Create `src/lib/samAdapter.ts`: WebGPU capability check and segmentation adapter interface.
- Create `src/lib/history.ts`: undo/redo stack for mask operations.
- Create `src/components/Icon.tsx`: internal SVG icon set, no English abbreviation placeholders.
- Create `src/components/TopBar.tsx`: import/template/rename actions.
- Create `src/components/ImageQueue.tsx`: image queue and drag import target.
- Create `src/components/EditorCanvas.tsx`: canvas preview and drag import target.
- Create `src/components/ToolBar.tsx`: selection/repair tools plus separate history group.
- Create `src/components/ExportPanel.tsx`: templates and final export actions.
- Create `src/components/RenameDialog.tsx`: CSV download/upload flow.
- Create `src/components/TemplateDialog.tsx`: save/apply templates.
- Create `src/test/setup.ts`: DOM test setup.
- Create `src/**/*.test.ts` and `src/**/*.test.tsx`: unit and component tests.
- Create `tests/e2e/smoke.spec.ts`: app smoke test.
- Create `.github/workflows/pages.yml`: GitHub Pages build/deploy workflow.

## Task 1: Scaffold The Static React App

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Add package scripts and dependencies**

Use this `package.json` baseline:

```json
{
  "name": "ui-image-processor",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "typescript": "latest",
    "react": "latest",
    "react-dom": "latest",
    "jszip": "latest",
    "papaparse": "latest",
    "onnxruntime-web": "latest"
  },
  "devDependencies": {
    "@playwright/test": "latest",
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@types/node": "latest",
    "@types/papaparse": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "jsdom": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 2: Add Vite and TypeScript config**

`vite.config.ts` must include:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === 'true' ? '/ui-image-processor/' : '/',
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true
  }
});
```

`src/test/setup.ts` must include:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Add the minimal app**

`src/App.tsx` should initially render:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <h1>UI 图片处理器</h1>
      <p>本地处理 · PNG 工作流</p>
    </main>
  );
}
```

- [ ] **Step 4: Install and verify**

Run: `npm install`

Run: `npm run build`

Expected: build exits 0 and creates `dist/`.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.node.json src
git commit -m "chore: scaffold image processor app"
```

## Task 2: Define Domain Types And Pure Import Logic

**Files:**
- Create: `src/types.ts`
- Create: `src/lib/fileImport.ts`
- Create: `src/lib/fileImport.test.ts`

- [ ] **Step 1: Write import filtering tests**

Test cases:

```ts
import { describe, expect, it } from 'vitest';
import { isSupportedImageFile, makeQueueItemName } from './fileImport';

describe('file import helpers', () => {
  it('accepts png jpg jpeg and webp files', () => {
    expect(isSupportedImageFile(new File([], 'a.png', { type: 'image/png' }))).toBe(true);
    expect(isSupportedImageFile(new File([], 'a.jpg', { type: 'image/jpeg' }))).toBe(true);
    expect(isSupportedImageFile(new File([], 'a.jpeg', { type: 'image/jpeg' }))).toBe(true);
    expect(isSupportedImageFile(new File([], 'a.webp', { type: 'image/webp' }))).toBe(true);
  });

  it('rejects non image files', () => {
    expect(isSupportedImageFile(new File([], 'a.txt', { type: 'text/plain' }))).toBe(false);
  });

  it('preserves original filename for queue display', () => {
    expect(makeQueueItemName(new File([], 'hero_ref_01.webp'))).toBe('hero_ref_01.webp');
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- src/lib/fileImport.test.ts`

Expected: FAIL because `fileImport.ts` does not exist.

- [ ] **Step 3: Implement types and import helpers**

`src/types.ts` defines `ImageQueueItem`, `CropRatio`, `CropRect`, `ExportSettings`, `Template`, `RenameMapping`, and `AppMode`.

`src/lib/fileImport.ts` must export:

```ts
const SUPPORTED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

export function isSupportedImageFile(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return file.type.startsWith('image/') && SUPPORTED_EXTENSIONS.has(extension);
}

export function makeQueueItemName(file: File): string {
  return file.name;
}
```

- [ ] **Step 4: Run passing test**

Run: `npm test -- src/lib/fileImport.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/types.ts src/lib/fileImport.ts src/lib/fileImport.test.ts
git commit -m "feat: add image import helpers"
```

## Task 3: Build V6 Layout And Internal SVG Icons

**Files:**
- Create: `src/components/Icon.tsx`
- Create: `src/components/TopBar.tsx`
- Create: `src/components/ImageQueue.tsx`
- Create: `src/components/ToolBar.tsx`
- Create: `src/components/EditorCanvas.tsx`
- Create: `src/components/ExportPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write layout tests**

Assert:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App layout', () => {
  it('shows core top actions and keeps zip in export panel', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /导入图片/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /套用模板/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /批量重命名/ })).toBeInTheDocument();
    expect(screen.getByText('模板与导出')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /下载 ZIP/ })).toBeInTheDocument();
  });

  it('separates repair tools from history controls', () => {
    render(<App />);
    expect(screen.getByText('选择与修补')).toBeInTheDocument();
    expect(screen.getByText('历史')).toBeInTheDocument();
    expect(screen.getByTitle('撤销')).toBeInTheDocument();
    expect(screen.getByTitle('重做')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because components are not implemented.

- [ ] **Step 3: Implement components**

Implement V6 layout:

- Top actions: 导入图片, 套用模板, 批量重命名.
- Tool group: SAM 点选, 反点选, 橡皮擦, 恢复, 裁剪.
- History group: circular undo and redo SVG icons with tooltip titles.
- Crop ratios: 1:1, 4:3, 3:4, 16:9, 9:16, 自由.
- Export panel: 保存模板, 导出当前 PNG, 下载 ZIP.

Icons must be internal SVG components, not English abbreviation text.

- [ ] **Step 4: Run passing tests**

Run: `npm test -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/App.tsx src/styles.css src/components src/App.test.tsx
git commit -m "feat: build image processor workspace layout"
```

## Task 4: Implement Queue Import, Drag Drop, And WebP Decode

**Files:**
- Modify: `src/lib/fileImport.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/TopBar.tsx`
- Modify: `src/components/ImageQueue.tsx`
- Modify: `src/components/EditorCanvas.tsx`
- Test: `src/lib/fileImport.test.ts`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Add tests for dropped files**

Add test:

```ts
it('filters a FileList-like collection into supported images', () => {
  const files = [
    new File([], 'a.webp', { type: 'image/webp' }),
    new File([], 'b.txt', { type: 'text/plain' }),
    new File([], 'c.png', { type: 'image/png' })
  ];
  expect(filterSupportedImageFiles(files).map((file) => file.name)).toEqual(['a.webp', 'c.png']);
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- src/lib/fileImport.test.ts`

Expected: FAIL because `filterSupportedImageFiles` does not exist.

- [ ] **Step 3: Implement filtering and queue creation**

Add:

```ts
export function filterSupportedImageFiles(files: Iterable<File>): File[] {
  return Array.from(files).filter(isSupportedImageFile);
}
```

Use `URL.createObjectURL(file)` for preview URLs. Keep object URL cleanup in React effects.

- [ ] **Step 4: Wire UI import**

TopBar exposes a hidden `<input type="file" multiple accept="image/png,image/jpeg,image/webp">`.

Queue and canvas handle `dragover` and `drop`, then call the same import path.

- [ ] **Step 5: Verify**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src
git commit -m "feat: support multi-image import and drag drop"
```

## Task 5: Implement Crop And Export Engine

**Files:**
- Create: `src/lib/canvasExport.ts`
- Create: `src/lib/canvasExport.test.ts`
- Modify: `src/types.ts`
- Modify: `src/components/ExportPanel.tsx`

- [ ] **Step 1: Write pure export settings tests**

Test:

```ts
import { normalizeExportSettings } from './canvasExport';

it('locks transparent exports to png', () => {
  expect(normalizeExportSettings({
    format: 'jpeg',
    width: 1024,
    height: 1024,
    backgroundType: 'transparent',
    backgroundColor: '#ffffff',
    cornerRadius: 24
  }).format).toBe('png');
});

it('keeps jpeg when background is solid', () => {
  expect(normalizeExportSettings({
    format: 'jpeg',
    width: 1024,
    height: 1024,
    backgroundType: 'solid',
    backgroundColor: '#ffffff',
    cornerRadius: 0
  }).format).toBe('jpeg');
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- src/lib/canvasExport.test.ts`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement export settings and filename extension**

Implement:

```ts
export function normalizeExportSettings(settings: ExportSettings): ExportSettings {
  if (settings.backgroundType === 'transparent' && settings.format === 'jpeg') {
    return { ...settings, format: 'png' };
  }
  return settings;
}

export function extensionForFormat(format: ExportSettings['format']): string {
  return format === 'jpeg' ? 'jpg' : 'png';
}
```

- [ ] **Step 4: Implement canvas export**

Add `exportCanvasImage(source, crop, settings): Promise<Blob>` that:

- Draws crop region to an offscreen canvas.
- Applies output width and height.
- Applies round corner clipping.
- Fills solid background before drawing image when needed.
- Exports `image/png` or `image/jpeg`.

- [ ] **Step 5: Verify**

Run: `npm test -- src/lib/canvasExport.test.ts`

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/canvasExport.ts src/lib/canvasExport.test.ts src/types.ts src/components/ExportPanel.tsx
git commit -m "feat: add crop and export engine"
```

## Task 6: Implement CSV Rename Round Trip

**Files:**
- Create: `src/lib/csvRename.ts`
- Create: `src/lib/csvRename.test.ts`
- Create: `src/components/RenameDialog.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write CSV tests**

Test:

```ts
import { buildRenameCsv, parseRenameCsv } from './csvRename';

it('builds a utf8 bom csv template', () => {
  const csv = buildRenameCsv(['hero_ref_01.webp']);
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain('index,old_filename,new_filename');
  expect(csv).toContain('1,hero_ref_01.webp,');
});

it('parses new filenames by old filename', () => {
  const result = parseRenameCsv('index,old_filename,new_filename\n1,hero_ref_01.webp,ui_button_start\n', ['hero_ref_01.webp']);
  expect(result.mappings[0].newFilename).toBe('ui_button_start');
  expect(result.errors).toEqual([]);
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- src/lib/csvRename.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement CSV build and parse**

Use PapaParse. Validate:

- Old filename exists.
- New filename does not contain `\ / : * ? " < > |`.
- Duplicate new filenames are errors.
- Empty new filename is allowed and means keep old name.

- [ ] **Step 4: Implement RenameDialog**

Dialog actions:

- 下载命名 CSV.
- 上传命名 CSV.
- Show validation errors.
- Show count of mapped filenames.

- [ ] **Step 5: Verify**

Run: `npm test -- src/lib/csvRename.test.ts`

Run: `npm test -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/csvRename.ts src/lib/csvRename.test.ts src/components/RenameDialog.tsx src/App.tsx
git commit -m "feat: add csv rename workflow"
```

## Task 7: Implement Template Persistence

**Files:**
- Create: `src/lib/templateStore.ts`
- Create: `src/lib/templateStore.test.ts`
- Create: `src/components/TemplateDialog.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/ExportPanel.tsx`

- [ ] **Step 1: Write template store tests**

Test:

```ts
import { createMemoryTemplateStore } from './templateStore';

it('saves and lists templates', async () => {
  const store = createMemoryTemplateStore();
  await store.save({ name: '透明 UI 参考', cropRatio: '1:1', width: 1024, height: 1024, format: 'png', backgroundType: 'transparent', backgroundColor: '#ffffff', cornerRadius: 24, namingRule: 'ui_ref_{n}' });
  expect((await store.list())[0].name).toBe('透明 UI 参考');
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- src/lib/templateStore.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement template store**

Implement memory store for tests and browser store using IndexedDB. Fall back to LocalStorage when IndexedDB is unavailable.

- [ ] **Step 4: Implement template UI**

Save current settings as a named template and apply a template to current/all images.

- [ ] **Step 5: Verify and commit**

Run: `npm test`

Run: `npm run build`

Commit:

```powershell
git add src
git commit -m "feat: persist export templates locally"
```

## Task 8: Implement ZIP Export

**Files:**
- Create: `src/lib/zipExport.ts`
- Create: `src/lib/zipExport.test.ts`
- Modify: `src/components/ExportPanel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write filename resolution tests**

Test:

```ts
import { resolveExportFilename } from './zipExport';

it('uses csv rename and appends png extension', () => {
  expect(resolveExportFilename('hero_ref_01.webp', 'ui_button_start', 'png')).toBe('ui_button_start.png');
});

it('keeps old basename when csv name is empty', () => {
  expect(resolveExportFilename('hero_ref_01.webp', '', 'jpeg')).toBe('hero_ref_01.jpg');
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- src/lib/zipExport.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement ZIP helpers**

Use JSZip. `createExportZip(items, settings, renameMap)` returns a Blob.

- [ ] **Step 4: Wire export panel**

Right panel actions:

- 保存模板.
- 导出当前 PNG/JPG.
- 下载 ZIP.

Top bar must still not contain ZIP.

- [ ] **Step 5: Verify and commit**

Run: `npm test`

Run: `npm run build`

Commit:

```powershell
git add src
git commit -m "feat: add zip export"
```

## Task 9: Add SAM Capability Adapter And Graceful Fallback

**Files:**
- Create: `src/lib/samAdapter.ts`
- Create: `src/lib/samAdapter.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/ToolBar.tsx`

- [ ] **Step 1: Write capability tests**

Test:

```ts
import { detectSamMode } from './samAdapter';

it('returns degraded mode when webgpu is missing', () => {
  expect(detectSamMode({ gpuAvailable: false, workerAvailable: true })).toBe('degraded');
});

it('returns full mode when webgpu and worker are available', () => {
  expect(detectSamMode({ gpuAvailable: true, workerAvailable: true })).toBe('full');
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- src/lib/samAdapter.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement adapter**

Implement:

- `detectBrowserCapabilities()`.
- `detectSamMode(capabilities)`.
- `Segmenter` interface with `load()` and `segmentByPoints()`.
- A `UnavailableSegmenter` that returns a clear error in degraded mode.

Do not block import, crop, CSV, or export when SAM is unavailable.

- [ ] **Step 4: Surface mode in UI**

Show `WebGPU 完整模式` or `降级模式`. Disable SAM point tools in degraded mode and keep manual tools active.

- [ ] **Step 5: Verify and commit**

Run: `npm test`

Run: `npm run build`

Commit:

```powershell
git add src
git commit -m "feat: add sam capability fallback"
```

## Task 10: Add Playwright Smoke Test And GitHub Pages Workflow

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/smoke.spec.ts`
- Create: `.github/workflows/pages.yml`
- Modify: `package.json`

- [ ] **Step 1: Write smoke test**

Test:

```ts
import { expect, test } from '@playwright/test';

test('loads the image processor workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /导入图片/ })).toBeVisible();
  await expect(page.getByText('选择与修补')).toBeVisible();
  await expect(page.getByRole('button', { name: /下载 ZIP/ })).toBeVisible();
});
```

- [ ] **Step 2: Add Pages workflow**

Workflow:

- Checkout.
- Setup Node.
- `npm ci`.
- `npm run build` with `GITHUB_PAGES=true`.
- Upload `dist`.
- Deploy to GitHub Pages.

- [ ] **Step 3: Verify locally**

Run: `npm run build`

Run: `npm run e2e`

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add package.json playwright.config.ts tests .github
git commit -m "ci: add pages deployment workflow"
```

## Task 11: Final Verification

**Files:**
- No new files unless verification reveals defects.

- [ ] **Step 1: Full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Browser verification**

Run: `npm run dev`

Open local URL in browser. Verify:

- Top actions are prominent.
- Canvas is large and centered.
- ZIP button is in right export panel.
- Crop ratios include 1:1, 4:3, 3:4, 16:9, 9:16, 自由.
- WebP is accepted by file input.
- CSV rename dialog opens.
- Degraded SAM state does not block export.

- [ ] **Step 4: Git status**

Run: `git status --short`

Expected: clean after final commit.

## Self-Review

Spec coverage:

- Multi-image import and WebP support: Tasks 2 and 4.
- V6 UI, icon rules, ZIP placement, large canvas: Task 3.
- Crop ratios including 3:4 and 9:16: Task 3 and Task 5.
- PNG/JPG export and transparent background lock: Task 5.
- CSV round-trip rename: Task 6.
- Local templates: Task 7.
- ZIP export: Task 8.
- SAM WebGPU/fallback: Task 9.
- GitHub Pages static deployment: Task 10.

Placeholder scan:

- No implementation task uses `TBD`, `TODO`, or English abbreviation icon placeholders.

Type consistency:

- Shared types are created before modules consume them.
- Export format names are consistently `png` and `jpeg`; file extension helper maps `jpeg` to `.jpg`.

