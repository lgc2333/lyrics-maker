import { describe, expect, it, vi } from 'vitest'

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
    const getFile = vi.fn(async () => new File(['{"version":1}'], 'demo.json'))
    const write = vi.fn()
    const close = vi.fn()
    const createWritable = vi.fn(async () => ({ write, close }))
    const showOpenFilePicker = vi.fn(async () => [{ getFile, createWritable }])
    const service = createProjectFileService({ showOpenFilePicker })

    const openResult = await service.openProject()

    expect(openResult.ok).toBe(true)
    expect(openResult.content).toBe('{"version":1}')
    expect(openResult.fileName).toBe('demo.json')
    expect(service.hasCachedHandle()).toBe(true)

    await service.save('changed')
    expect(createWritable).toHaveBeenCalled()
    expect(write).toHaveBeenCalledWith('changed')
  })

  it('returns unsupported when opening is unavailable', async () => {
    const service = createProjectFileService({})

    const result = await service.openProject()

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unsupported')
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
})
