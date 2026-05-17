import { describe, expect, it } from 'vitest'

import { createEmptyProject } from '../domain/project'
import {
  createAddTimingPointCommand,
  createRemoveTimingPointCommand,
  createSetAudioVolumeCommand,
  createUpdateTimingPointCommand,
} from './project-commands'

describe('timing point commands', () => {
  it('adds and removes timing points via commands', () => {
    const payload = {
      id: 'tp-2',
      time: 12,
      bpm: 150,
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
    }
    const command = createAddTimingPointCommand(payload)
    const afterAdd = command.do(createEmptyProject())
    expect(afterAdd.timingPoints.some((p) => p.id === 'tp-2')).toBe(true)
    const afterUndo = command.undo(afterAdd)
    expect(afterUndo.timingPoints.some((p) => p.id === 'tp-2')).toBe(false)
  })

  it('updates a timing point via command', () => {
    const command = createUpdateTimingPointCommand('tp-1', { bpm: 140 })
    const afterUpdate = command.do(createEmptyProject())
    expect(afterUpdate.timingPoints[0].bpm).toBe(140)
    expect(afterUpdate.timingPoints[0].time).toBe(0) // unchanged
    const afterUndo = command.undo(afterUpdate)
    expect(afterUndo.timingPoints[0].bpm).toBe(120)
  })

  it('removes a timing point via command', () => {
    const command = createRemoveTimingPointCommand('tp-1')
    const afterRemove = command.do(createEmptyProject())
    expect(afterRemove.timingPoints).toHaveLength(0)
    const afterUndo = command.undo(afterRemove)
    expect(afterUndo.timingPoints).toHaveLength(1)
    expect(afterUndo.timingPoints[0].id).toBe('tp-1')
  })
})

describe('audio volume commands', () => {
  it('sets music volume via command', () => {
    const command = createSetAudioVolumeCommand('music', 0.5)
    const afterSet = command.do(createEmptyProject())
    expect(afterSet.audio.musicVolume).toBe(0.5)
    expect(afterSet.audio.sfxVolume).toBe(0.8) // unchanged
    const afterUndo = command.undo(afterSet)
    expect(afterUndo.audio.musicVolume).toBe(1)
  })

  it('sets sfx volume via command', () => {
    const command = createSetAudioVolumeCommand('sfx', 0.3)
    const afterSet = command.do(createEmptyProject())
    expect(afterSet.audio.sfxVolume).toBe(0.3)
    expect(afterSet.audio.musicVolume).toBe(1) // unchanged
    const afterUndo = command.undo(afterSet)
    expect(afterUndo.audio.sfxVolume).toBe(0.8)
  })
})
