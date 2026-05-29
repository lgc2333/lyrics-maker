<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ProjectValidationIssue } from '../../core/domain/project-validation'

const props = defineProps<{
  mode: 'export' | 'readonly'
  issues: readonly ProjectValidationIssue[]
}>()

const emit = defineEmits<{
  continue: []
  cancel: []
  close: []
}>()

const { t, te } = useI18n()

const errorIssues = computed(() =>
  props.issues.filter((issue) => issue.severity === 'error'),
)
const warningIssues = computed(() =>
  props.issues.filter((issue) => issue.severity === 'warning'),
)

function issueText(issue: ProjectValidationIssue): string {
  return te(issue.messageKey) ? t(issue.messageKey, issue.params ?? {}) : issue.code
}
</script>

<template>
  <div
    data-testid="project-validation-modal"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-4"
    role="dialog"
    aria-modal="true"
    :aria-label="t('project.validation.title')"
  >
    <section
      class="flex max-h-[min(34rem,calc(100vh-2rem))] w-full max-w-2xl flex-col rounded-md border border-base-300 bg-base-100 p-4 shadow-xl"
    >
      <h2 class="text-base font-semibold">
        {{ t('project.validation.title') }}
      </h2>
      <p
        data-testid="project-validation-summary"
        class="mt-2 text-sm text-base-content/75"
      >
        {{
          t('project.validation.summary', {
            errors: errorIssues.length,
            warnings: warningIssues.length,
          })
        }}
      </p>
      <p v-if="mode === 'export'" class="mt-1 text-sm text-warning">
        {{ t('project.validation.exportPrompt') }}
      </p>

      <div class="mt-4 min-h-0 overflow-auto rounded border border-base-300">
        <ul class="divide-y divide-base-300">
          <li
            v-for="issue in issues"
            :key="`${issue.path}:${issue.code}`"
            data-testid="project-validation-issue"
            class="grid grid-cols-[4rem_minmax(8rem,0.7fr)_1fr] gap-2 px-3 py-2 text-sm"
          >
            <span
              class="font-semibold"
              :class="issue.severity === 'error' ? 'text-error' : 'text-warning'"
            >
              {{
                issue.severity === 'error'
                  ? t('project.validation.error')
                  : t('project.validation.warning')
              }}
            </span>
            <code class="truncate text-xs text-base-content/60">
              {{ issue.path }}
            </code>
            <span>{{ issueText(issue) }}</span>
          </li>
        </ul>
      </div>

      <div class="mt-4 flex justify-end gap-2">
        <button
          v-if="mode === 'readonly'"
          data-testid="project-validation-close"
          type="button"
          class="btn btn-sm btn-primary"
          @click="emit('close')"
        >
          {{ t('project.validation.close') }}
        </button>
        <template v-else>
          <button
            data-testid="project-validation-cancel"
            type="button"
            class="btn btn-sm btn-ghost"
            @click="emit('cancel')"
          >
            {{ t('project.validation.cancel') }}
          </button>
          <button
            data-testid="project-validation-continue"
            type="button"
            class="btn btn-sm btn-warning"
            @click="emit('continue')"
          >
            {{ t('project.validation.continueExport') }}
          </button>
        </template>
      </div>
    </section>
  </div>
</template>
