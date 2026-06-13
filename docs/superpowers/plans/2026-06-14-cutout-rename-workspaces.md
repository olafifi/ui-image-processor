# Cutout And Rename Workspace Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to execute this plan task-by-task. Keep tests close to the logic being changed.

**Goal:** Turn the current UI shell into a usable local image-processing workflow for fake-transparent assets and batch rename work. Imported images should get an automatic first-pass cutout, manual repair tools should edit the actual exported pixels, and batch rename should become a dedicated workspace instead of a modal.

**Constraints:**
- Stay pure frontend and GitHub Pages compatible.
- Do not rely on server AI for this pass.
- Preserve light foreground details where possible; never globally delete all white pixels.
- Export must use the processed/cutout image when available.
- Batch rename CSV remains the primary bulk workflow, with per-image edits available in the rename workspace.

## Task 1: Add Background Removal Logic

**Files:**
- Create: `src/lib/backgroundRemoval.ts`
- Create: `src/lib/backgroundRemoval.test.ts`
- Modify: `src/types.ts`

- [ ] Add tests for:
  - Real-alpha PNG detection keeps existing alpha.
  - Fake checkerboard background is made transparent.
  - Edge-connected light background is removed without deleting an isolated colored subject.
- [ ] Implement conservative edge flood-fill from border pixels.
- [ ] Return a processed PNG data URL plus a short detection label for UI status.

## Task 2: Add Manual Cutout Editing

**Files:**
- Create: `src/lib/cutoutEdit.ts`
- Create: `src/lib/cutoutEdit.test.ts`
- Modify: `src/components/ToolBar.tsx`
- Modify: `src/components/EditorCanvas.tsx`
- Modify: `src/App.tsx`

- [ ] Add tests for eraser alpha removal and restore brush copying original pixels back.
- [ ] Add image item state for `cutoutStatus`, `processedPreviewUrl`, `cutoutMessage`, and edit history.
- [ ] Run automatic cutout after import.
- [ ] Make eraser, restore brush, point subtract, point restore, undo, and redo real controls.
- [ ] Map pointer coordinates to the contained image rect, not the whole canvas.

## Task 3: Use Processed Image In Export

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/lib/zipExport.ts` if needed
- Test: existing export and ZIP tests

- [ ] Single-image export should load `processedPreviewUrl` when present.
- [ ] ZIP export should export processed images for every item that has a processed preview.
- [ ] Keep PNG/JPG and background rules unchanged.

## Task 4: Replace Rename Modal With Workspace

**Files:**
- Create: `src/components/RenameWorkspace.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/TopBar.tsx`
- Modify: `src/styles.css`
- Test: `src/App.test.tsx`

- [ ] Add `workspaceMode: 'edit' | 'rename'`.
- [ ] In rename mode show:
  - Left image list.
  - Center selected image preview.
  - Right old filename and editable new filename.
  - Top actions for downloading CSV, importing CSV, showing current table, and returning to image editing.
- [ ] Keep CSV download/import as the bulk path.
- [ ] Add a compact current-name table view inside the workspace.

## Task 5: Verify With Real Assets

**Commands:**
- `npm test`
- `npm run build`
- `npm run e2e`

**Browser checks:**
- Import `赞美太阳.png`; automatic cutout should no longer export the painted checkerboard as white.
- Import several emoji assets; rename workspace should show list, preview, old/new names, CSV download/import, and ZIP output names.
- Eraser/restore should visibly affect the exported PNG.
