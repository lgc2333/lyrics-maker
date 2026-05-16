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
      types: [{ description: 'Lyrics Project', accept: { 'application/json': ['.json'] } }],
    })
    expect(createWritable).toHaveBeenCalled()
    expect(write).toHaveBeenCalledWith('{"version":1}')
    expect(close).toHaveBeenCalled()
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
})
