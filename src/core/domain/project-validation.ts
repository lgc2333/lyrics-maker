import type { ProjectDocument } from './project'

export type ProjectValidationSeverity = 'error' | 'warning'

export type ProjectValidationCode =
  | 'emptyTitle'
  | 'emptyId'
  | 'duplicateId'
  | 'nonFiniteTime'
  | 'negativeTime'
  | 'invalidBpm'
  | 'invalidTimeSignatureNumerator'
  | 'invalidTimeSignatureDenominator'
  | 'duplicateTimingPointTime'
  | 'emptyWords'
  | 'missingLineStartTime'
  | 'lineStartAfterEnd'
  | 'lineIntervalOverlap'
  | 'lineOrderRegression'
  | 'wordEndBeforeBoundary'
  | 'missingWordEndTime'
  | 'missingLineTiming'
  | 'untimedEmptyPlaceholder'

export type ProjectValidationTarget =
  | 'all'
  | 'txt'
  | 'lrc-line'
  | 'lrc-enhanced'
  | 'lrc-eslyric'
  | 'ttml'
  | 'ass'
  | 'srt'
  | 'vtt'

export interface ProjectValidationIssue {
  severity: ProjectValidationSeverity
  code: ProjectValidationCode
  path: string
  messageKey: string
  params?: Record<string, string | number>
}

const TIME_EPSILON = 0.001

function isBeforeTime(left: number, right: number): boolean {
  return left < right - TIME_EPSILON
}

function isAfterTime(left: number, right: number): boolean {
  return left > right + TIME_EPSILON
}

function isWordTimingSensitiveTarget(target: ProjectValidationTarget): boolean {
  return (
    target === 'all' ||
    target === 'ttml' ||
    target === 'lrc-enhanced' ||
    target === 'lrc-eslyric' ||
    target === 'ass'
  )
}

function isLineTimingSensitiveTarget(target: ProjectValidationTarget): boolean {
  return (
    target === 'all' || target === 'lrc-line' || target === 'srt' || target === 'vtt'
  )
}

function issue(
  severity: ProjectValidationSeverity,
  code: ProjectValidationCode,
  path: string,
  params?: Record<string, string | number>,
): ProjectValidationIssue {
  return {
    severity,
    code,
    path,
    messageKey: `project.validation.issues.${code}`,
    params,
  }
}

function checkTimeValue(
  value: number | undefined,
  path: string,
  issues: ProjectValidationIssue[],
): boolean {
  if (value === undefined) return false
  if (!Number.isFinite(value)) {
    issues.push(issue('error', 'nonFiniteTime', path))
    return false
  }
  if (value < 0) {
    issues.push(issue('error', 'negativeTime', path, { value }))
  }
  return true
}

function addIdIssue(
  id: string,
  path: string,
  seenIds: Map<string, string>,
  issues: ProjectValidationIssue[],
): void {
  const trimmed = id.trim()
  if (!trimmed) {
    issues.push(issue('error', 'emptyId', path))
    return
  }
  const firstPath = seenIds.get(trimmed)
  if (firstPath) {
    issues.push(issue('error', 'duplicateId', path, { id: trimmed, firstPath }))
    return
  }
  seenIds.set(trimmed, path)
}

function lastTimedWordEnd(line: ProjectDocument['lyrics'][number]): number | undefined {
  for (let index = line.words.length - 1; index >= 0; index -= 1) {
    const endTime = line.words[index].endTime
    if (endTime !== undefined && Number.isFinite(endTime)) return endTime
  }
  return undefined
}

export function validateProjectForExport(
  project: ProjectDocument,
  target: ProjectValidationTarget = 'all',
): ProjectValidationIssue[] {
  const issues: ProjectValidationIssue[] = []
  const seenIds = new Map<string, string>()
  const seenTimingTimes = new Map<number, string>()

  if (!project.title.trim()) {
    issues.push(issue('warning', 'emptyTitle', 'title'))
  }

  project.timingPoints.forEach((point, pointIndex) => {
    const basePath = `timingPoints[${pointIndex}]`
    addIdIssue(point.id, `${basePath}.id`, seenIds, issues)

    if (checkTimeValue(point.time, `${basePath}.time`, issues)) {
      const firstPath = seenTimingTimes.get(point.time)
      if (firstPath) {
        issues.push(
          issue('warning', 'duplicateTimingPointTime', `${basePath}.time`, {
            firstPath,
            value: point.time,
          }),
        )
      } else {
        seenTimingTimes.set(point.time, `${basePath}.time`)
      }
    }

    if (!Number.isFinite(point.bpm) || point.bpm <= 0) {
      issues.push(issue('error', 'invalidBpm', `${basePath}.bpm`))
    }
    if (
      !Number.isFinite(point.timeSignatureNumerator) ||
      !Number.isInteger(point.timeSignatureNumerator) ||
      point.timeSignatureNumerator <= 0
    ) {
      issues.push(
        issue(
          'error',
          'invalidTimeSignatureNumerator',
          `${basePath}.timeSignatureNumerator`,
        ),
      )
    }
    if (
      !Number.isFinite(point.timeSignatureDenominator) ||
      !Number.isInteger(point.timeSignatureDenominator) ||
      point.timeSignatureDenominator <= 0
    ) {
      issues.push(
        issue(
          'error',
          'invalidTimeSignatureDenominator',
          `${basePath}.timeSignatureDenominator`,
        ),
      )
    }
  })

  let previousLineStart: number | undefined
  let previousLineEnd: number | undefined

  project.lyrics.forEach((line, lineIndex) => {
    const lineNumber = lineIndex + 1
    const basePath = `lyrics[${lineIndex}]`
    addIdIssue(line.id, `${basePath}.id`, seenIds, issues)
    const hasValidLineStart = checkTimeValue(
      line.startTime,
      `${basePath}.startTime`,
      issues,
    )

    if (line.words.length === 0) {
      issues.push(
        issue('error', 'emptyWords', `${basePath}.words`, { line: lineNumber }),
      )
    }

    let boundary = line.startTime
    let hasTimedWord = false
    let hasVisibleUntimedWord = false
    let hasAnyWordEnd = false

    line.words.forEach((word, wordIndex) => {
      const wordNumber = wordIndex + 1
      const wordPath = `${basePath}.words[${wordIndex}]`
      addIdIssue(word.id, `${wordPath}.id`, seenIds, issues)
      const visible = word.text.length > 0
      const hasEndTime = word.endTime !== undefined
      const hasValidEndTime = checkTimeValue(
        word.endTime,
        `${wordPath}.endTime`,
        issues,
      )

      if (!visible && !hasEndTime) {
        issues.push(
          issue('warning', 'untimedEmptyPlaceholder', wordPath, {
            line: lineNumber,
            word: wordNumber,
          }),
        )
      }

      if (visible && !hasEndTime) {
        hasVisibleUntimedWord = true
      }

      if (hasEndTime) {
        hasAnyWordEnd = true
      }

      if (hasValidEndTime && word.endTime !== undefined) {
        hasTimedWord = true
        if (
          boundary !== undefined &&
          Number.isFinite(boundary) &&
          isBeforeTime(word.endTime, boundary)
        ) {
          issues.push(
            issue('error', 'wordEndBeforeBoundary', `${wordPath}.endTime`, {
              line: lineNumber,
              word: wordNumber,
            }),
          )
        }
        boundary = word.endTime
      }
    })

    if (hasTimedWord && line.startTime === undefined && target !== 'txt') {
      issues.push(
        issue('error', 'missingLineStartTime', `${basePath}.startTime`, {
          line: lineNumber,
        }),
      )
    }

    const lineEnd = lastTimedWordEnd(line)
    if (
      line.startTime !== undefined &&
      Number.isFinite(line.startTime) &&
      lineEnd !== undefined &&
      isAfterTime(line.startTime, lineEnd)
    ) {
      issues.push(
        issue('error', 'lineStartAfterEnd', `${basePath}.startTime`, {
          line: lineNumber,
        }),
      )
    }

    if (
      hasValidLineStart &&
      line.startTime !== undefined &&
      previousLineStart !== undefined &&
      isBeforeTime(line.startTime, previousLineStart)
    ) {
      issues.push(
        issue('warning', 'lineOrderRegression', `${basePath}.startTime`, {
          line: lineNumber,
        }),
      )
    }

    if (
      hasValidLineStart &&
      line.startTime !== undefined &&
      previousLineEnd !== undefined &&
      isAfterTime(previousLineEnd, line.startTime)
    ) {
      issues.push(
        issue('error', 'lineIntervalOverlap', `${basePath}.startTime`, {
          line: lineNumber,
        }),
      )
    }

    if (isWordTimingSensitiveTarget(target) && hasVisibleUntimedWord) {
      issues.push(
        issue('warning', 'missingWordEndTime', `${basePath}.words`, {
          line: lineNumber,
        }),
      )
    }

    if (
      isLineTimingSensitiveTarget(target) &&
      (line.startTime === undefined || !hasAnyWordEnd)
    ) {
      issues.push(
        issue('warning', 'missingLineTiming', basePath, {
          line: lineNumber,
        }),
      )
    }

    if (hasValidLineStart && line.startTime !== undefined) {
      previousLineStart = line.startTime
    }
    if (lineEnd !== undefined) {
      previousLineEnd = lineEnd
    }
  })

  return issues
}
