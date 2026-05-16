import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from './editor-store'

describe('editor store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('initializes with an empty project', () => {
    const store = useEditorStore()

    expect(store.project.title).toBe('Untitled Project')
    expect(store.project.lyrics).toHaveLength(0)
    expect(store.project.version).toBe(1)
  })

  it('supports add line + undo + redo', () => {
    const store = useEditorStore()

    store.addLyricLine('hello world')
    expect(store.project.lyrics).toHaveLength(1)
    expect(store.project.lyrics[0].text).toBe('hello world')

    store.undo()
    expect(store.project.lyrics).toHaveLength(0)

    store.redo()
    expect(store.project.lyrics).toHaveLength(1)
  })

  it('tracks dirty flag', () => {
    const store = useEditorStore()

    expect(store.dirty).toBe(false)

    store.addLyricLine('line 1')
    expect(store.dirty).toBe(true)
  })

  it('tracks canUndo and canRedo flags', () => {
    const store = useEditorStore()

    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(false)

    store.addLyricLine('line 1')
    expect(store.canUndo).toBe(true)
    expect(store.canRedo).toBe(false)

    store.undo()
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(true)
  })

  it('clears redo stack after a new execute', () => {
    const store = useEditorStore()

    store.addLyricLine('line 1')
    store.undo()
    expect(store.canRedo).toBe(true)

    store.addLyricLine('line 2')
    expect(store.canRedo).toBe(false)
    expect(store.project.lyrics).toHaveLength(1)
    expect(store.project.lyrics[0].text).toBe('line 2')
  })

  it('adds multiple lines', () => {
    const store = useEditorStore()

    store.addLyricLine('line 1')
    store.addLyricLine('line 2')
    store.addLyricLine('line 3')

    expect(store.project.lyrics).toHaveLength(3)
    expect(store.project.lyrics[0].text).toBe('line 1')
    expect(store.project.lyrics[1].text).toBe('line 2')
    expect(store.project.lyrics[2].text).toBe('line 3')
  })

  it('each line has a unique id', () => {
    const store = useEditorStore()

    store.addLyricLine('line 1')
    store.addLyricLine('line 2')

    const ids = store.project.lyrics.map((l) => l.id)

    expect(ids[0]).toMatch(/^line-/)
    expect(ids[1]).toMatch(/^line-/)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('returns fresh snapshot after each mutation', () => {
    const store = useEditorStore()

    store.addLyricLine('first')
    const snapshot1 = store.project

    store.addLyricLine('second')
    const snapshot2 = store.project

    expect(snapshot1).not.toBe(snapshot2)
    expect(snapshot1.lyrics).toHaveLength(1)
    expect(snapshot2.lyrics).toHaveLength(2)
  })

  it('initializes lastError as null', () => {
    const store = useEditorStore()
    expect(store.lastError).toBeNull()
  })

  it('markClean sets dirty to false', () => {
    const store = useEditorStore()

    store.addLyricLine('line 1')
    expect(store.dirty).toBe(true)

    store.markClean()
    expect(store.dirty).toBe(false)
  })

  it('saveProject serializes project and calls saveAs', async () => {
    const saveAs = vi.fn(async (_content: string) => ({ ok: true as const }))
    const service = { saveAs }
    const store = useEditorStore()

    store.addLyricLine('hello world')
    const result = await store.saveProject(service)

    expect(result.ok).toBe(true)
    expect(saveAs).toHaveBeenCalledOnce()
    const json = saveAs.mock.calls[0][0]
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(1)
    expect(parsed.lyrics).toHaveLength(1)
    expect(parsed.lyrics[0].text).toBe('hello world')
    expect(store.dirty).toBe(false)
  })

  it('saveProject sets lastError on failure', async () => {
    const saveAs = vi.fn(async (_content: string) => ({
      ok: false as const,
      reason: 'unsupported' as const,
    }))
    const service = { saveAs }
    const store = useEditorStore()

    const result = await store.saveProject(service)

    expect(result.ok).toBe(false)
    expect(store.lastError).toBe('unsupported')
  })
})
