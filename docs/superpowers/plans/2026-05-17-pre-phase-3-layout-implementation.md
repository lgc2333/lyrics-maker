# Pre Phase 3 Layout Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a sketch-aligned pre-Phase-3 shell layout with real timing-panel interactions, mode switching, and refined transport controls while deferring waveform/spectrogram rendering.

**Architecture:** Keep business state in `editor-store` and command-driven updates, while moving shell composition into focused Vue components (`MenuBar`, `MainView`, `TimingPointsPanel`, `LyricsPanel`, `TransportBar`). Add only minimal UI-local state (`editorMode`, selection, panel sizing, hover states). Extend timing utility/store only where transport interactions require deterministic bar-step seeking.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), Pinia, Vitest + Vue Test Utils, DaisyUI/Tailwind, `@iconify/vue`, existing core timing engine utilities.

---

## File Structure & Responsibilities

- **UI icon policy:** all UI icons must come from Iconify (`@iconify/vue`), and emoji must not be used in rendered controls.
- **Modify:** `src/components/shell/AppShell.vue` — compose new shell order and mode-based panel mounting.
- **Modify:** `src/components/shell/MenuBar.vue` — thin menubar, click menus, theme toggle, mode switch emitters.
- **Modify:** `src/components/shell/MainView.vue` — placeholder visual container + drag-to-resize height.
- **Modify:** `src/components/shell/TransportBar.vue` — strict left-to-right control order + hover vertical volume controls + wheel control.
- **Create:** `src/components/shell/TimingPointsPanel.vue` — timing list states + right control area.
- **Create:** `src/components/shell/LyricsPanel.vue` — lyrics-mode layout scaffold.
- **Modify:** `src/stores/editor-store.ts` — add transport helpers needed by UI (bar-step seek + snap toggle state if required).
- **Modify:** `src/core/timing/timing-engine.ts` — add previous/next bar-time helpers for deterministic transport jumps.
- **Modify/Test:** `src/core/timing/timing-engine.spec.ts` — cover new bar-step helpers.
- **Modify/Test:** `src/stores/editor-store.spec.ts` — cover new transport helper actions.
- **Modify/Test:** `src/components/shell/AppShell.spec.ts` — new shell structure and mode panel switching.
- **Modify/Test:** `src/components/shell/TransportBar.spec.ts` — volume popover/wheel behavior + button actions.
- **Create/Test:** `src/components/shell/MainView.spec.ts` — height drag interactions and bounds.
- **Create/Test:** `src/components/shell/TimingPointsPanel.spec.ts` — selected/active/combined row states and control dispatch.
- **Create/Test:** `src/components/shell/MenuBar.spec.ts` — click-open menu skeleton + mode/theme controls.
- **Modify:** `src/platform/i18n/locales/zh-CN.ts` — new menu/transport/timing labels.
- **Modify:** `docs/superpowers/specs/2026-05-17-pre-phase-3-layout-design.md` — append implementation notes if behavior diverges.

### Task 1: Recompose shell + mode panel split

**Files:**
- Modify: `src/components/shell/AppShell.vue`
- Create: `src/components/shell/TimingPointsPanel.vue`
- Create: `src/components/shell/LyricsPanel.vue`
- Test: `src/components/shell/AppShell.spec.ts`

- [ ] **Step 1: Write failing shell-structure tests**

```ts
it('renders timing panel by default and can switch to lyrics panel', async () => {
  const wrapper = mount(AppShell)
  expect(wrapper.find('[data-testid="timing-points-panel"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="lyrics-panel"]').exists()).toBe(false)

  await wrapper.get('[data-testid="mode-switch-lyrics"]').trigger('click')
  expect(wrapper.find('[data-testid="timing-points-panel"]').exists()).toBe(false)
  expect(wrapper.find('[data-testid="lyrics-panel"]').exists()).toBe(true)
})
```

- [ ] **Step 2: Run focused component tests and capture failure**

Run: `pnpm test:run "src/components/shell/AppShell.spec.ts"`  
Expected: FAIL with missing `timing-points-panel` / mode-switch selectors.

- [ ] **Step 3: Implement AppShell composition and new panel components**

```vue
<!-- AppShell.vue -->
<script setup lang="ts">
import { ref } from 'vue'
const editorMode = ref<'timing' | 'lyrics'>('timing')
</script>

<template>
  <div class="flex h-screen flex-col">
    <MenuBar
      data-testid="menu-bar"
      :mode="editorMode"
      @switch-mode="editorMode = $event"
    />
    <MainView data-testid="main-view" />
    <TransportBar data-testid="transport-bar" />
    <TimingPointsPanel v-if="editorMode === 'timing'" data-testid="timing-points-panel" />
    <LyricsPanel v-else data-testid="lyrics-panel" />
  </div>
</template>
```

- [ ] **Step 4: Re-run shell tests**

Run: `pnpm test:run "src/components/shell/AppShell.spec.ts"`  
Expected: PASS.

- [ ] **Step 5: Commit task**

```bash
git add src/components/shell/AppShell.vue src/components/shell/AppShell.spec.ts src/components/shell/TimingPointsPanel.vue src/components/shell/LyricsPanel.vue
git commit -m "feat(shell): split mode workspace into timing and lyrics panels"
```

### Task 2: Implement thin MenuBar with click menus/theme/mode controls

**Files:**
- Modify: `src/components/shell/MenuBar.vue`
- Create: `src/components/shell/MenuBar.spec.ts`
- Modify: `src/platform/i18n/locales/zh-CN.ts`

- [ ] **Step 1: Write failing MenuBar interaction tests**

```ts
it('opens file menu on click and closes on second click', async () => {
  const wrapper = mount(MenuBar, { props: { mode: 'timing' } })
  await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
  expect(wrapper.find('[data-testid="menu-popup-file"]').exists()).toBe(true)
  await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
  expect(wrapper.find('[data-testid="menu-popup-file"]').exists()).toBe(false)
})

it('emits switch-mode when lyrics mode button clicked', async () => {
  const wrapper = mount(MenuBar, { props: { mode: 'timing' } })
  await wrapper.get('[data-testid="mode-switch-lyrics"]').trigger('click')
  expect(wrapper.emitted('switch-mode')?.[0]).toEqual(['lyrics'])
})
```

- [ ] **Step 2: Run MenuBar tests to verify failure**

Run: `pnpm test:run "src/components/shell/MenuBar.spec.ts"`  
Expected: FAIL because `MenuBar.spec.ts` and selectors are not implemented yet.

- [ ] **Step 3: Implement MenuBar**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
const props = defineProps<{ mode: 'timing' | 'lyrics' }>()
const emit = defineEmits<{ 'switch-mode': ['timing' | 'lyrics'] }>()
const openMenu = ref<'file' | 'edit' | 'view' | 'help' | null>(null)
</script>

<template>
  <header class="flex h-8 items-center border-b border-base-300 px-2 text-xs">
    <button data-testid="menu-trigger-file" @click="openMenu = openMenu === 'file' ? null : 'file'">文件</button>
    <div class="ml-auto flex items-center gap-2">
      <button data-testid="theme-toggle"><Icon icon="material-symbols:light-mode-rounded" /></button>
      <button data-testid="mode-switch-timing" @click="emit('switch-mode', 'timing')">时轴</button>
      <button data-testid="mode-switch-lyrics" @click="emit('switch-mode', 'lyrics')">歌词</button>
    </div>
  </header>
</template>
```

- [ ] **Step 4: Re-run MenuBar tests**

Run: `pnpm test:run "src/components/shell/MenuBar.spec.ts"`  
Expected: PASS.

- [ ] **Step 5: Commit task**

```bash
git add src/components/shell/MenuBar.vue src/components/shell/MenuBar.spec.ts src/platform/i18n/locales/zh-CN.ts
git commit -m "feat(menu): add thin click-menu bar with theme and mode toggles"
```

### Task 3: MainView pre-phase-3 container with drag height

**Files:**
- Modify: `src/components/shell/MainView.vue`
- Create: `src/components/shell/MainView.spec.ts`

- [ ] **Step 1: Write failing drag-resize tests**

```ts
it('resizes height between min and max via drag handle', async () => {
  const wrapper = mount(MainView)
  const root = wrapper.get('[data-testid="main-view-container"]')
  const handle = wrapper.get('[data-testid="main-view-resize-handle"]')
  await handle.trigger('pointerdown', { clientY: 300 })
  window.dispatchEvent(new PointerEvent('pointermove', { clientY: 360 }))
  window.dispatchEvent(new PointerEvent('pointerup'))
  expect(parseInt((root.element as HTMLElement).style.height, 10)).toBeGreaterThanOrEqual(250)
})
```

- [ ] **Step 2: Run MainView tests to verify failure**

Run: `pnpm test:run "src/components/shell/MainView.spec.ts"`  
Expected: FAIL because no resize handle/state exists.

- [ ] **Step 3: Implement drag-resize behavior**

```vue
<script setup lang="ts">
import { ref } from 'vue'
const height = ref(250)
const min = 180
const max = 520
</script>

<template>
  <section data-testid="main-view-container" :style="{ height: `${height}px` }" class="relative border-b border-base-300 bg-base-200/30">
    <div class="p-3 text-xs opacity-70">波形 / 频谱区域（Pre Phase 3 占位）</div>
    <div data-testid="main-view-resize-handle" class="absolute inset-x-0 bottom-0 h-2 cursor-row-resize" />
  </section>
</template>
```

- [ ] **Step 4: Re-run MainView tests**

Run: `pnpm test:run "src/components/shell/MainView.spec.ts"`  
Expected: PASS.

- [ ] **Step 5: Commit task**

```bash
git add src/components/shell/MainView.vue src/components/shell/MainView.spec.ts
git commit -m "feat(main-view): add pre-phase-3 resizable placeholder container"
```

### Task 4: TransportBar ordered controls + bar-jump + volume popovers

**Files:**
- Modify: `src/components/shell/TransportBar.vue`
- Modify: `src/stores/editor-store.ts`
- Modify: `src/stores/editor-store.spec.ts`
- Modify: `src/core/timing/timing-engine.ts`
- Modify: `src/core/timing/timing-engine.spec.ts`
- Modify: `src/components/shell/TransportBar.spec.ts`

- [ ] **Step 1: Add failing timing/store tests for bar-step seek**

```ts
it('seeks to previous and next bar boundaries', () => {
  const store = useEditorStore()
  store.seekPlayback(4.1)
  store.seekToPreviousBar()
  expect(store.currentTime).toBeLessThan(4.1)
  store.seekToNextBar()
  expect(store.currentTime).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run timing/store focused tests and verify failure**

Run: `pnpm test:run "src/core/timing/timing-engine.spec.ts" "src/stores/editor-store.spec.ts"`  
Expected: FAIL for missing bar-step utility/actions.

- [ ] **Step 3: Implement bar-step utilities + store actions + transport UI behavior**

```ts
// timing-engine.ts
export function getPreviousBarTime(points: readonly TimingPoint[], time: number): number {
  const info = getBeatInfoAtTime(points, time)
  const point = getActiveTimingPoint(points, time)
  const dur = 60 / point.bpm
  const beatsInBar = (point.timeSignatureNumerator * 4) / point.timeSignatureDenominator
  const currentBarStartBeat = Math.floor(info.beatIndex / beatsInBar) * beatsInBar
  const prevBarStartBeat = currentBarStartBeat - beatsInBar
  return point.time + prevBarStartBeat * dur
}
```

```ts
// editor-store.ts
function seekToNextBar(): void {
  if (project.value.timingPoints.length === 0) return
  seekPlayback(getNextBarTime(project.value.timingPoints, _currentTime.value))
}
function seekToPreviousBar(): void {
  if (project.value.timingPoints.length === 0) return
  seekPlayback(getPreviousBarTime(project.value.timingPoints, _currentTime.value))
}
```

```vue
<!-- TransportBar.vue (order + volume interactions) -->
<script setup lang="ts">
import { Icon } from '@iconify/vue'
</script>

<section class="flex items-center gap-2 border-b border-base-300 px-2 py-1.5">
  <button data-testid="metro-toggle"><Icon icon="material-symbols:metronome" /></button>
  <button data-testid="snap-toggle"><Icon icon="material-symbols:magnet-rounded" /></button>
  <div class="mx-1 h-4 w-px bg-base-300" />
  <button data-testid="prev-bar"><Icon icon="material-symbols:skip-previous-rounded" /></button>
  <button data-testid="play-toggle"><Icon icon="material-symbols:play-arrow-rounded" /></button>
  <button data-testid="next-bar"><Icon icon="material-symbols:skip-next-rounded" /></button>
  <span data-testid="play-time">{{ formatTime(store.currentTime) }} / {{ formatTime(store.duration) }}</span>
  <input
    data-testid="playback-progress"
    type="range"
    min="0"
    :max="store.duration || 0"
    step="0.01"
    :value="store.currentTime"
    class="range range-xs w-56"
    :disabled="store.duration <= 0"
    @input="onSeek"
  />
  <div data-testid="music-volume" class="group relative">
    <button><Icon icon="material-symbols:music-note-rounded" /></button>
    <div class="invisible absolute bottom-6 right-0 group-hover:visible">
      <div class="text-[10px] text-center">{{ Math.round(store.project.audio.musicVolume * 100) }}%</div>
      <input class="range range-xs h-24" type="range" min="0" max="1" step="0.01" />
    </div>
  </div>
  <div data-testid="sfx-volume" class="group relative">
    <button><Icon icon="material-symbols:graphic-eq-rounded" /></button>
    <div class="invisible absolute bottom-6 right-0 group-hover:visible">
      <div class="text-[10px] text-center">{{ Math.round(store.project.audio.sfxVolume * 100) }}%</div>
      <input class="range range-xs h-24" type="range" min="0" max="1" step="0.01" />
    </div>
  </div>
</section>
```

- [ ] **Step 4: Re-run Transport/timing/store tests**

Run: `pnpm test:run "src/core/timing/timing-engine.spec.ts" "src/stores/editor-store.spec.ts" "src/components/shell/TransportBar.spec.ts"`  
Expected: PASS.

- [ ] **Step 5: Commit task**

```bash
git add src/components/shell/TransportBar.vue src/components/shell/TransportBar.spec.ts src/stores/editor-store.ts src/stores/editor-store.spec.ts src/core/timing/timing-engine.ts src/core/timing/timing-engine.spec.ts
git commit -m "feat(transport): add ordered controls, bar-step seek, and hover volume sliders"
```

### Task 5: TimingPointsPanel real row states + control area wiring

**Files:**
- Modify: `src/components/shell/TimingPointsPanel.vue`
- Create: `src/components/shell/TimingPointsPanel.spec.ts`
- Modify: `src/platform/i18n/locales/zh-CN.ts`

- [ ] **Step 1: Add failing panel-state tests**

```ts
it('applies selected and active row classes independently', async () => {
  setActivePinia(createPinia())
  const store = useEditorStore()
  store.addTimingPoint({
    time: 5,
    bpm: 140,
    timeSignatureNumerator: 4,
    timeSignatureDenominator: 4,
    offsetMs: 0,
  })
  const wrapper = mount(TimingPointsPanel)
  const rows = wrapper.findAll('[data-testid="timing-point-row"]') // row[0]=tp-1, row[1]=tp-2
  await rows[0].trigger('click')
  expect(rows[0].classes()).toContain('is-selected')
  store.seekPlayback(5.1)
  await wrapper.vm.$nextTick()
  expect(rows[1].classes()).toContain('is-active')
})
```

- [ ] **Step 2: Run panel tests and verify failure**

Run: `pnpm test:run "src/components/shell/TimingPointsPanel.spec.ts"`  
Expected: FAIL due missing selector/classes/control section.

- [ ] **Step 3: Implement timing panel states and controls**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '../../stores/editor-store'
const store = useEditorStore()
const selectedId = ref<string | null>(null)
const activeId = computed(() => store.activeTimingPointId)
const selectedPoint = computed(() =>
  store.project.timingPoints.find((p) => p.id === selectedId.value) ?? null,
)
const isSelected = (id: string) => selectedId.value === id
const isActive = (id: string) => activeId.value === id
function adjustOffset(deltaMs: number) {
  if (!selectedPoint.value) return
  store.updateTimingPoint(selectedPoint.value.id, {
    offsetMs: selectedPoint.value.offsetMs + deltaMs,
  })
}
function addPointAtCurrentTime() {
  store.addTimingPoint({
    time: store.currentTime,
    bpm: selectedPoint.value?.bpm ?? 120,
    timeSignatureNumerator: selectedPoint.value?.timeSignatureNumerator ?? 4,
    timeSignatureDenominator: selectedPoint.value?.timeSignatureDenominator ?? 4,
    offsetMs: selectedPoint.value?.offsetMs ?? 0,
  })
}
</script>

<template>
  <section class="flex flex-1 overflow-hidden border-t border-base-300">
    <ul class="flex-1 overflow-auto">
      <li
        v-for="point in store.project.timingPoints"
        :key="point.id"
        data-testid="timing-point-row"
        :class="{ 'is-selected': isSelected(point.id), 'is-active': isActive(point.id), 'is-selected-active': isSelected(point.id) && isActive(point.id) }"
        @click="selectedId = point.id"
      />
    </ul>
    <aside class="w-64 border-l border-base-300 p-2">
      <div class="text-sm">Offset {{ selectedPoint?.offsetMs ?? 0 }} ms</div>
      <button class="btn btn-xs" @click="adjustOffset(-10)">-10</button>
      <button class="btn btn-xs" @click="adjustOffset(-5)">-5</button>
      <button class="btn btn-xs" @click="adjustOffset(5)">+5</button>
      <button class="btn btn-xs" @click="adjustOffset(10)">+10</button>
      <button class="btn btn-sm btn-primary mt-2" @click="store.tapBpm()">Tap BPM</button>
      <button class="btn btn-xs mt-2" @click="addPointAtCurrentTime">在此添加时轴点</button>
    </aside>
  </section>
</template>
```

- [ ] **Step 4: Re-run panel tests**

Run: `pnpm test:run "src/components/shell/TimingPointsPanel.spec.ts"`  
Expected: PASS.

- [ ] **Step 5: Commit task**

```bash
git add src/components/shell/TimingPointsPanel.vue src/components/shell/TimingPointsPanel.spec.ts src/platform/i18n/locales/zh-CN.ts
git commit -m "feat(timing-panel): add active/selected list states and right-side controls"
```

### Task 6: LyricsPanel scaffold + regression suite + docs sync

**Files:**
- Modify: `src/components/shell/LyricsPanel.vue`
- Modify: `src/components/shell/AppShell.spec.ts`
- Modify: `docs/superpowers/specs/2026-05-17-pre-phase-3-layout-design.md`

- [ ] **Step 1: Add/extend tests for lyrics-mode scaffold visibility**

```ts
it('renders lyrics panel scaffold controls in lyrics mode', async () => {
  const wrapper = mount(AppShell)
  await wrapper.get('[data-testid="mode-switch-lyrics"]').trigger('click')
  expect(wrapper.find('[data-testid="lyrics-panel"]').text()).toContain('歌词模式')
})
```

- [ ] **Step 2: Run shell-related tests and verify failure**

Run: `pnpm test:run "src/components/shell/AppShell.spec.ts"`  
Expected: FAIL before scaffold content selectors are added.

- [ ] **Step 3: Implement lyrics scaffold and spec delta note**

```vue
<!-- LyricsPanel.vue -->
<template>
  <section data-testid="lyrics-panel" class="flex flex-1 border-t border-base-300">
    <div class="flex-1 p-3 text-sm opacity-80">歌词编辑区（Pre Phase 3 骨架）</div>
    <aside class="w-64 border-l border-base-300 p-3 text-sm">节拍器 / 吸附控制（占位）</aside>
  </section>
</template>
```

- [ ] **Step 4: Run full repo checks**

Run: `pnpm lint && pnpm test:run && pnpm build && pnpm format`  
Expected: all commands succeed.

- [ ] **Step 5: Commit task**

```bash
git add src/components/shell/LyricsPanel.vue src/components/shell/AppShell.spec.ts docs/superpowers/specs/2026-05-17-pre-phase-3-layout-design.md
git commit -m "feat(lyrics-panel): add pre-phase-3 lyrics workspace scaffold and finalize layout refresh"
```

## Spec Coverage Self-Review

- ✅ MenuBar 细化 + 点击菜单骨架 + 主题/模式切换：Task 2
- ✅ MainView 全区域占位 + 拖拽高度：Task 3
- ✅ ModePanel 拆分为 TimingPointsPanel/LyricsPanel：Task 1 + Task 6
- ✅ TransportBar 顺序与音量交互细化：Task 4
- ✅ Timing 列表 selected/active/叠加真实联动：Task 5
- ✅ Pre Phase 3 边界（不做波形/频谱渲染）：Task 3 + Task 6 文档同步

## Placeholder/Consistency Scan

- No `TODO`/`TBD` placeholders in tasks.
- New methods naming consistency: `seekToNextBar`, `seekToPreviousBar`, `getNextBarTime`, `getPreviousBarTime`.
- Test paths and target files explicitly listed per task.
