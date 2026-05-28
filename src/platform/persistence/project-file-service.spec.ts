import { describe, expect, it, vi } from 'vitest'

import { createEmptyProject } from '../../core/domain/project'
import { createProjectFileService } from './project-file-service'

describe('project file service', () => {
  it('returns unsupported when File System Access API is unavailable', async () => {
    const service = createProjectFileService({})
    const result = await service.saveAs('{"version":1}')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unsupported')
  })

  it('writes JSON via writable stream', async () => {
    const write = vi.fn()
    const close = vi.fn()
    const createWritable = vi.fn(async () => ({ write, close }))
    const showSaveFilePicker = vi.fn(async () => ({ createWritable }))
    const service = createProjectFileService({ showSaveFilePicker })
    const result = await service.saveAs('{"version":1}')
    expect(result.ok).toBe(true)
    expect(showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: 'lyrics-project.json',
      types: [
        { description: 'Lyrics Project', accept: { 'application/json': ['.json'] } },
      ],
    })
    expect(createWritable).toHaveBeenCalled()
    expect(write).toHaveBeenCalledWith('{"version":1}')
    expect(close).toHaveBeenCalled()
  })

  it('opens a project JSON file and caches the opened file handle', async () => {
    const getFile = vi.fn(
      async () => new File([JSON.stringify(createEmptyProject())], 'demo.json'),
    )
    const write = vi.fn()
    const close = vi.fn()
    const createWritable = vi.fn(async () => ({ write, close }))
    const showOpenFilePicker = vi.fn(async () => [{ getFile, createWritable }])
    const service = createProjectFileService({ showOpenFilePicker })

    const openResult = await service.openProject()

    expect(openResult.ok).toBe(true)
    expect(openResult.content).toBe(JSON.stringify(createEmptyProject()))
    expect(openResult.fileName).toBe('demo.json')
    expect(service.hasCachedHandle()).toBe(true)

    await service.save('changed')
    expect(createWritable).toHaveBeenCalled()
    expect(write).toHaveBeenCalledWith('changed')
  })

  it('opens old project JSON files with legacy preference fields', async () => {
    const project = createEmptyProject()
    const legacyProject = {
      ...project,
      audio: { musicVolume: 0.25, sfxVolume: 0.5 },
      settings: {
        locale: 'zh-CN',
        snapEnabled: false,
        snapDivisor: 8,
      },
    }
    const getFile = vi.fn(
      async () => new File([JSON.stringify(legacyProject)], 'legacy.json'),
    )
    const createWritable = vi.fn()
    const showOpenFilePicker = vi.fn(async () => [{ getFile, createWritable }])
    const service = createProjectFileService({ showOpenFilePicker })

    const openResult = await service.openProject()

    expect(openResult.ok).toBe(true)
    expect(service.hasCachedHandle()).toBe(true)
    expect(openResult.project).toEqual(project)
    expect(openResult.content).toBe(JSON.stringify(project))
  })

  it('returns unsupported when opening is unavailable', async () => {
    const service = createProjectFileService({})

    const result = await service.openProject()

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unsupported')
  })

  it('returns invalid and does not cache the file handle when opened JSON has an unsupported project version', async () => {
    const getFile = vi.fn(async () => new File(['{"version":2}'], 'bad.json'))
    const createWritable = vi.fn()
    const showOpenFilePicker = vi.fn(async () => [{ getFile, createWritable }])
    const service = createProjectFileService({ showOpenFilePicker })

    const result = await service.openProject()

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('invalid')
    expect(service.hasCachedHandle()).toBe(false)
  })

  it('saveAs accepts a project title for suggested file name', async () => {
    const write = vi.fn()
    const close = vi.fn()
    const createWritable = vi.fn(async () => ({ write, close }))
    const showSaveFilePicker = vi.fn(async () => ({ createWritable }))
    const service = createProjectFileService({ showSaveFilePicker })

    await service.saveAs('{"version":1}', 'My Song')

    expect(showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'My Song.json' }),
    )
  })

  it('auto save does not open a picker when no cached handle exists', async () => {
    const showSaveFilePicker = vi.fn()
    const service = createProjectFileService({ showSaveFilePicker })

    const result = await service.save('auto content')

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_cached_handle')
    expect(showSaveFilePicker).not.toHaveBeenCalled()
  })

  it('returns ok:false with reason failed when save throws', async () => {
    const createWritable = vi.fn(async () => {
      throw new Error('disk full')
    })
    const showSaveFilePicker = vi.fn(async () => ({ createWritable }))
    const service = createProjectFileService({ showSaveFilePicker })
    const result = await service.saveAs('{}')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('failed')
    expect(result.errorMessage).toBe('disk full')
  })

  it('save reuses cached file handle without showing picker again', async () => {
    const write = vi.fn()
    const close = vi.fn()
    const createWritable = vi.fn(async () => ({ write, close }))
    const showSaveFilePicker = vi.fn(async () => ({ createWritable }))
    const service = createProjectFileService({ showSaveFilePicker })

    // First save via saveAs
    const result1 = await service.saveAs('content v1')
    expect(result1.ok).toBe(true)
    expect(showSaveFilePicker).toHaveBeenCalledTimes(1)

    // Subsequent save reuses cached handle
    const result2 = await service.save('content v2')
    expect(result2.ok).toBe(true)
    expect(showSaveFilePicker).toHaveBeenCalledTimes(1) // not called again
    expect(write).toHaveBeenLastCalledWith('content v2')
  })

  it('save returns no_cached_handle when no cached handle exists', async () => {
    const service = createProjectFileService({})
    const result = await service.save('content')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_cached_handle')
  })

  it('returns cancelled when user aborts save dialog', async () => {
    const showSaveFilePicker = vi.fn(async () => {
      throw new DOMException('User cancelled', 'AbortError')
    })
    const service = createProjectFileService({ showSaveFilePicker })
    const result = await service.saveAs('{}')

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('cancelled')
    expect(result.errorMessage).toBeUndefined()
  })

  it('opens a lyrics file and detects its format', async () => {
    const getFile = vi.fn(async () => new File(['WEBVTT\n\n'], 'song.txt'))
    const createWritable = vi.fn()
    const showOpenFilePicker = vi.fn(async () => [{ getFile, createWritable }])
    const service = createProjectFileService({ showOpenFilePicker })

    const result = await service.openLyricsFile()

    expect(result).toEqual({
      ok: true,
      content: 'WEBVTT\n\n',
      fileName: 'song.txt',
      format: 'vtt',
      displayFormat: 'vtt',
    })
  })

  it('opens a lyrics file and reports the detected LRC display format', async () => {
    const getFile = vi.fn(
      async () => new File(['[00:01.000]<00:01.000>你'], 'song.lrc'),
    )
    const createWritable = vi.fn()
    const showOpenFilePicker = vi.fn(async () => [{ getFile, createWritable }])
    const service = createProjectFileService({ showOpenFilePicker })

    const result = await service.openLyricsFile()

    expect(result).toEqual({
      ok: true,
      content: '[00:01.000]<00:01.000>你',
      fileName: 'song.lrc',
      format: 'lrc',
      displayFormat: 'lrc-enhanced',
    })
  })

  it('classifies dropped project files without caching a handle', async () => {
    const service = createProjectFileService({})

    const result = await service.readAnyFile(
      new File([JSON.stringify(createEmptyProject())], 'project.json'),
    )

    expect(result.ok).toBe(true)
    expect(result.kind).toBe('project')
    if (!result.ok || result.kind !== 'project') {
      throw new Error('expected project file')
    }
    expect(result.project).toEqual(createEmptyProject())
    expect(service.hasCachedHandle()).toBe(false)
  })

  it('saves lyrics with the target format extension', async () => {
    const write = vi.fn()
    const close = vi.fn()
    const createWritable = vi.fn(async () => ({ write, close }))
    const showSaveFilePicker = vi.fn(async () => ({ createWritable }))
    const service = createProjectFileService({ showSaveFilePicker })

    const result = await service.saveLyrics('lyrics', {
      format: 'lrc',
      projectTitle: 'My Song',
    })

    expect(result.ok).toBe(true)
    expect(showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'My Song.lrc' }),
    )
    expect(write).toHaveBeenCalledWith('lyrics')
  })

  it('saves all LRC export targets with the lrc extension', async () => {
    for (const target of ['lrc-line', 'lrc-enhanced', 'lrc-eslyric'] as const) {
      const write = vi.fn()
      const close = vi.fn()
      const createWritable = vi.fn(async () => ({ write, close }))
      const showSaveFilePicker = vi.fn(async () => ({ createWritable }))
      const service = createProjectFileService({ showSaveFilePicker })

      await service.saveLyrics('lyrics', {
        target,
        projectTitle: 'My Song',
      })

      expect(showSaveFilePicker).toHaveBeenCalledWith(
        expect.objectContaining({ suggestedName: 'My Song.lrc' }),
      )
    }
  })
})
