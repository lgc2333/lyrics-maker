import { z } from 'zod'

const lyricWordSchema = z.object({
  id: z.string(),
  text: z.string(),
  endTime: z.number().optional(),
})

const lyricLineSchema = z.object({
  id: z.string(),
  words: z.array(lyricWordSchema),
  startTime: z.number().optional(),
})

const timingPointSchema = z.object({
  id: z.string(),
  time: z.number(),
  bpm: z.number(),
  timeSignatureNumerator: z.number(),
  timeSignatureDenominator: z.number(),
})

const projectSettingsSchema = z.object({
  locale: z.literal('zh-CN').default('zh-CN'),
})

export const projectDocumentSchema = z.object({
  version: z.literal(1).default(1),
  title: z.string().default('Untitled Project'),
  settings: projectSettingsSchema.default({ locale: 'zh-CN' }),
  lyrics: z.array(lyricLineSchema).default(() => []),
  timingPoints: z.array(timingPointSchema).default(() => [
    {
      id: 'tp-1',
      time: 0,
      bpm: 120,
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
    },
  ]),
})

export type LocaleCode = z.infer<typeof projectSettingsSchema>['locale']
export type ProjectSettings = z.infer<typeof projectSettingsSchema>
export type LyricWord = z.infer<typeof lyricWordSchema>
export type LyricLine = z.infer<typeof lyricLineSchema>
export type TimingPoint = z.infer<typeof timingPointSchema>
export type ProjectDocument = z.infer<typeof projectDocumentSchema>

export function parseProjectDocument(value: unknown): ProjectDocument | null {
  const result = projectDocumentSchema.safeParse(value)
  return result.success ? result.data : null
}

export function createEmptyProject(): ProjectDocument {
  return projectDocumentSchema.parse({})
}
