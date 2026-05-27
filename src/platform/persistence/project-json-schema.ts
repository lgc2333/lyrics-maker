import { z } from 'zod'

import type { ProjectDocument } from '../../core/domain/project'

const lyricWordSchema = z.strictObject({
  id: z.string(),
  text: z.string(),
  endTime: z.number().optional(),
})

const lyricLineSchema = z.strictObject({
  id: z.string(),
  words: z.array(lyricWordSchema),
  startTime: z.number().optional(),
})

const timingPointSchema = z.strictObject({
  id: z.string(),
  time: z.number(),
  bpm: z.number(),
  timeSignatureNumerator: z.number(),
  timeSignatureDenominator: z.number(),
})

export const projectDocumentSchema: z.ZodType<ProjectDocument> = z.strictObject({
  version: z.literal(1),
  title: z.string(),
  settings: z.strictObject({
    locale: z.literal('zh-CN'),
  }),
  lyrics: z.array(lyricLineSchema),
  timingPoints: z.array(timingPointSchema),
})

export function parseProjectDocument(value: unknown): ProjectDocument | null {
  const result = projectDocumentSchema.safeParse(value)
  return result.success ? result.data : null
}
