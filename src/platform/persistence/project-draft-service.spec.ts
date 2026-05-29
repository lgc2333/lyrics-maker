import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createEmptyProject } from '../../core/domain/project'
import { createProjectDraftService } from './project-draft-service'

describe('project draft service', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and loads a valid project draft', () => {
    const service = createProjectDraftService(localStorage)
    const project = createEmptyProject()

    const saveResult = service.saveDraft(JSON.stringify(project))
    const loadResult = service.loadDraft()

    expect(saveResult.ok).toBe(true)
    expect(loadResult.ok).toBe(true)
    expect(loadResult.content).toBe(JSON.stringify(project))
    expect(loadResult.project?.title).toBe(project.title)
  })

  it('returns no_draft when no draft exists', () => {
    const service = createProjectDraftService(localStorage)

    const result = service.loadDraft()

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_draft')
  })

  it('returns invalid when stored draft is malformed JSON', () => {
    const service = createProjectDraftService(localStorage)
    localStorage.setItem('lyrics-maker.project-draft.v1', '{')

    const result = service.loadDraft()

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('invalid')
  })

  it('returns invalid when stored draft has an unsupported project version', () => {
    const service = createProjectDraftService(localStorage)
    localStorage.setItem(
      'lyrics-maker.project-draft.v1',
      JSON.stringify({ version: 2 }),
    )

    const result = service.loadDraft()

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('invalid')
  })

  it('returns invalid when stored draft has invalid nested project data', () => {
    const service = createProjectDraftService(localStorage)
    const project = createEmptyProject()
    localStorage.setItem(
      'lyrics-maker.project-draft.v1',
      JSON.stringify({
        ...project,
        timingPoints: [
          {
            id: 'tp-1',
            time: 0,
            bpm: '120',
            timeSignatureNumerator: 4,
            timeSignatureDenominator: 4,
          },
        ],
      }),
    )

    const result = service.loadDraft()

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('invalid')
  })

  it('loads old drafts with legacy preference fields and strips them from the parsed project', () => {
    const service = createProjectDraftService(localStorage)
    const project = createEmptyProject()
    localStorage.setItem(
      'lyrics-maker.project-draft.v1',
      JSON.stringify({
        ...project,
        audio: { musicVolume: 0.25, sfxVolume: 0.5 },
        settings: {
          locale: 'zh-CN',
          snapEnabled: false,
          snapDivisor: 8,
        },
      }),
    )

    const result = service.loadDraft()

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected legacy draft to load')
    expect(result.project).toEqual(project)
  })

  it('clears saved drafts', () => {
    const service = createProjectDraftService(localStorage)
    service.saveDraft(JSON.stringify(createEmptyProject()))

    service.clearDraft()

    expect(service.loadDraft().reason).toBe('no_draft')
  })

  it('reports storage failure without throwing', () => {
    const storage: Storage = {
      length: 0,
      clear: vi.fn(),
      getItem: vi.fn(() => {
        throw new Error('blocked')
      }),
      key: vi.fn(),
      removeItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error('quota')
      }),
    }
    const service = createProjectDraftService(storage)

    expect(service.saveDraft('{}')).toMatchObject({ ok: false, reason: 'failed' })
    expect(service.loadDraft()).toMatchObject({ ok: false, reason: 'failed' })
  })
})
