<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

const height = ref(250)
const min = 180
const max = 520

let dragging = false
let startY = 0
let startHeight = 0

function onPointerDown(e: PointerEvent) {
  dragging = true
  startY = e.clientY
  startHeight = height.value
  e.preventDefault()
}

function onPointerMove(e: PointerEvent) {
  if (!dragging) return
  const delta = e.clientY - startY
  height.value = Math.max(min, Math.min(max, startHeight + delta))
}

function onPointerUp() {
  dragging = false
}

window.addEventListener('pointermove', onPointerMove)
window.addEventListener('pointerup', onPointerUp)

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})
</script>

<template>
  <section
    data-testid="main-view-container"
    :style="{ height: `${height}px` }"
    class="relative border-b border-base-300 bg-base-200/30"
  >
    <div class="p-3 text-xs opacity-70">波形 / 频谱区域（Pre Phase 3 占位）</div>
    <div
      data-testid="main-view-resize-handle"
      class="absolute inset-x-0 bottom-0 h-2 cursor-row-resize"
      @pointerdown="onPointerDown"
    />
  </section>
</template>
