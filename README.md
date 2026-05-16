# Lyrics Maker — 歌词打轴软件

一款 Web 端歌词打轴软件，提供类似 osu! editor 的 Timing 面板与 Aegisub 的字幕编辑体验。

## Tech Stack

Vue 3 + TypeScript + Vite + Pinia + Tailwind CSS v4 + DaisyUI v5

## Phase 1 (Infrastructure)

- Command-based undo/redo core for phase-1 actions
- zh-CN i18n scaffold (extensible)
- Shortcut registration framework (no rebinding UI yet)
- Ctrl+S save via File System Access API (Chrome/Edge preferred)
- Minimal app shell for next phases

## Browser Support

The File System Access API (`showSaveFilePicker`) is required for saving project files. Chrome and Edge are recommended. Browsers that do not support the API will receive a clear error message on save attempts.

## Scripts

```bash
pnpm dev          # Start dev server
pnpm build        # Type check + production build
pnpm test:run     # Run all tests
pnpm lint         # Lint check
pnpm lint:fix     # Auto-fix lint issues
pnpm check        # Type check only
```
