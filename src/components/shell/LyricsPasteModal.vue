<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  confirm: [text: string]
  cancel: []
}>()

const textContent = ref('')

function onConfirm(): void {
  emit('confirm', textContent.value)
  textContent.value = ''
}

function onCancel(): void {
  emit('cancel')
  textContent.value = ''
}
</script>

<template>
  <dialog data-testid="lyrics-paste-modal" class="modal modal-open">
    <div class="modal-box w-full max-w-lg">
      <h3 class="text-lg font-bold">粘贴歌词</h3>
      <textarea
        v-model="textContent"
        data-testid="lyrics-paste-textarea"
        class="textarea textarea-bordered mt-3 h-48 w-full font-mono text-sm"
        placeholder="每行一句歌词..."
        autofocus
      />
      <div class="modal-action">
        <button
          data-testid="paste-cancel-btn"
          class="btn btn-ghost btn-sm"
          @click="onCancel"
        >
          取消
        </button>
        <button
          data-testid="paste-confirm-btn"
          class="btn btn-primary btn-sm"
          :disabled="textContent.trim().length === 0"
          @click="onConfirm"
        >
          确定
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="onCancel">
      <button>close</button>
    </form>
  </dialog>
</template>
