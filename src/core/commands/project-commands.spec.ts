import { describe, expect, it } from 'vitest'

import { createEmptyProject } from '../domain/project'
import {
  createAddTimingPointCommand,
  createRemoveTimingPointCommand,
  createSetAudioVolumeCommand,
  createSetRhythmModeCommand,
  createSetSnapDivisorCommand,
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

  it('update command can be reused — undo restores to original state from first do()', () => {
    const project = createEmptyProject()
    const command = createUpdateTimingPointCommand('tp-1', { bpm: 140 })

    // First do/undo cycle
    const afterFirst = command.do(project)
    expect(afterFirst.timingPoints[0].bpm).toBe(140)

    // Second do on the same project — should capture the same original state
    const afterSecond = command.do(project)
    expect(afterSecond.timingPoints[0].bpm).toBe(140)

    // Undo should restore to the original state captured in do()
    const undone = command.undo(afterSecond)
    expect(undone.timingPoints[0].bpm).toBe(120)
  })

  it('remove command undo is a no-op if do() was never called', () => {
    const command = createRemoveTimingPointCommand('tp-1')
    const project = createEmptyProject()
    const result = command.undo(project)
    // Should return the project unchanged
    expect(result.timingPoints).toHaveLength(1)
    expect(result.timingPoints[0].id).toBe('tp-1')
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

  it('audio volume command undo is a no-op if do() was never called', () => {
    const command = createSetAudioVolumeCommand('music', 0.5)
    const project = createEmptyProject()
    const result = command.undo(project)
    expect(result.audio.musicVolume).toBe(1) // unchanged
  })

  it('audio volume command can be reused — undo restores original value', () => {
    const project = createEmptyProject()
    const command = createSetAudioVolumeCommand('sfx', 0.3)

    const afterOne = command.do(project)
    expect(afterOne.audio.sfxVolume).toBe(0.3)

    const afterTwo = command.do(project)
    expect(afterTwo.audio.sfxVolume).toBe(0.3)

    const undone = command.undo(afterTwo)
    expect(undone.audio.sfxVolume).toBe(0.8)
  })
})

describe('settings commands', () => {
  it('createSetRhythmModeCommand sets rhythmMode and is undoable', () => {
    const cmd = createSetRhythmModeCommand('triplets')
    const after = cmd.do(createEmptyProject())
    expect(after.settings.rhythmMode).toBe('triplets')
    const undone = cmd.undo(after)
    expect(undone.settings.rhythmMode).toBe('common')
  })

  it('createSetSnapDivisorCommand sets snapDivisor and is undoable', () => {
    const cmd = createSetSnapDivisorCommand(16)
    const after = cmd.do(createEmptyProject())
    expect(after.settings.snapDivisor).toBe(16)
    const undone = cmd.undo(after)
    expect(undone.settings.snapDivisor).toBe(4)
  })

  it('rhythmMode command undo is a no-op if do() was never called', () => {
    const cmd = createSetRhythmModeCommand('triplets')
    const project = createEmptyProject()
    const result = cmd.undo(project)
    expect(result.settings.rhythmMode).toBe('common') // unchanged
  })

  it('snapDivisor command undo is a no-op if do() was never called', () => {
    const cmd = createSetSnapDivisorCommand(16)
    const project = createEmptyProject()
    const result = cmd.undo(project)
    expect(result.settings.snapDivisor).toBe(4) // unchanged
  })

  it('rhythmMode command can be reused — undo restores original value', () => {
    const project = createEmptyProject()
    const cmd = createSetRhythmModeCommand('triplets')

    // First do
    const afterOne = cmd.do(project)
    expect(afterOne.settings.rhythmMode).toBe('triplets')

    // Second do on the same project — captures the same original state
    const afterTwo = cmd.do(project)
    expect(afterTwo.settings.rhythmMode).toBe('triplets')

    // Undo should restore the original
    const undone = cmd.undo(afterTwo)
    expect(undone.settings.rhythmMode).toBe('common')
  })

  it('snapDivisor command can be reused — undo restores original value', () => {
    const project = createEmptyProject()
    const cmd = createSetSnapDivisorCommand(16)

    const afterOne = cmd.do(project)
    expect(afterOne.settings.snapDivisor).toBe(16)

    const afterTwo = cmd.do(project)
    expect(afterTwo.settings.snapDivisor).toBe(16)

    const undone = cmd.undo(afterTwo)
    expect(undone.settings.snapDivisor).toBe(4)
  })
})
