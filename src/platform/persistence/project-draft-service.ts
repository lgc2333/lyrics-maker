import { parseProjectDocument } from '../../core/domain/project'
import type { ProjectDocument } from '../../core/domain/project'

export const PROJECT_DRAFT_STORAGE_KEY = 'lyrics-maker.project-draft.v1'

export interface DraftSaveResult {
  ok: boolean
  reason?: 'failed'
  errorMessage?: string
}

export interface DraftLoadResult {
  ok: boolean
  reason?: 'no_draft' | 'invalid' | 'failed'
  content?: string
  project?: ProjectDocument
  errorMessage?: string
}

export function createProjectDraftService(storage: Storage = localStorage) {
  function saveDraft(content: string): DraftSaveResult {
    try {
      storage.setItem(PROJECT_DRAFT_STORAGE_KEY, content)
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        reason: 'failed',
        errorMessage: error instanceof Error ? error.message : 'unknown',
      }
    }
  }

  function loadDraft(): DraftLoadResult {
    let content: string | null
    try {
      content = storage.getItem(PROJECT_DRAFT_STORAGE_KEY)
    } catch (error) {
      return {
        ok: false,
        reason: 'failed',
        errorMessage: error instanceof Error ? error.message : 'unknown',
      }
    }

    if (content === null) return { ok: false, reason: 'no_draft' }

    try {
      const parsed = JSON.parse(content) as unknown
      const project = parseProjectDocument(parsed)
      if (!project) return { ok: false, reason: 'invalid' }
      return { ok: true, content, project }
    } catch (error) {
      return {
        ok: false,
        reason: 'invalid',
        errorMessage: error instanceof Error ? error.message : 'unknown',
      }
    }
  }

  function clearDraft(): DraftSaveResult {
    try {
      storage.removeItem(PROJECT_DRAFT_STORAGE_KEY)
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        reason: 'failed',
        errorMessage: error instanceof Error ? error.message : 'unknown',
      }
    }
  }

  return { saveDraft, loadDraft, clearDraft }
}
