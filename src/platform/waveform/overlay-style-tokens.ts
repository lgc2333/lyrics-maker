export type OverlayTheme = 'light' | 'dark'
export type OverlayViewMode = 'waveform' | 'spectrogram'

export interface OverlayStyleContext {
  theme?: OverlayTheme
  viewMode?: OverlayViewMode
}

interface LineOverlayTokens {
  activeRangeBackground: string
  inactiveRangeBackground: string
  lineStart: string
  lineEnd: string
  partialActive: string
  partialInactive: string
  wordSeparatorActive: string
  wordSeparatorInactive: string
  activeWordText: string
  inactiveWordText: string
  wordTextShadow: string
  boundaryShadow: string
}

interface GridOverlayTokens {
  barStroke: string
  beatStroke: string
  subdivisionStroke: string
  previewLine: string
  previewBackground: string
  previewText: string
  previewShadow: string
}

interface PlayheadOverlayTokens {
  color: string
  shadow: string
  markerShadow: string
}

export interface OverlayStyleTokens {
  line: LineOverlayTokens
  grid: GridOverlayTokens
  playhead: PlayheadOverlayTokens
}

const DARK_WAVEFORM_TOKENS: OverlayStyleTokens = {
  line: {
    activeRangeBackground: 'rgba(100, 180, 255, 0.12)',
    inactiveRangeBackground: 'rgba(100, 180, 255, 0.05)',
    lineStart: 'rgba(255, 80, 80, 0.88)',
    lineEnd: 'rgba(100, 180, 255, 0.86)',
    partialActive: 'rgba(255, 214, 80, 0.88)',
    partialInactive: 'rgba(255, 214, 80, 0.5)',
    wordSeparatorActive: 'rgba(255, 214, 80, 0.88)',
    wordSeparatorInactive: 'rgba(255, 214, 80, 0.5)',
    activeWordText: 'rgba(255, 255, 255, 0.92)',
    inactiveWordText: 'rgba(255, 255, 255, 0.58)',
    wordTextShadow: '0 0 2px rgba(0, 0, 0, 0.74)',
    boundaryShadow: 'drop-shadow(0 0 2px rgba(0, 0, 0, 0.72))',
  },
  grid: {
    barStroke: 'rgba(255, 255, 255, 0.82)',
    beatStroke: 'rgba(255, 255, 255, 0.52)',
    subdivisionStroke: 'rgba(255, 255, 255, 0.22)',
    previewLine: 'rgba(255, 214, 80, 0.92)',
    previewBackground: 'rgba(0, 0, 0, 0.72)',
    previewText: 'rgba(255, 255, 255, 0.92)',
    previewShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
  },
  playhead: {
    color: 'rgb(255, 73, 73)',
    shadow: '0 0 0 1px rgba(0, 0, 0, 0.32), 0 0 6px rgba(255, 73, 73, 0.4)',
    markerShadow: 'drop-shadow(0 0 2px rgba(0, 0, 0, 0.72))',
  },
}

const LIGHT_WAVEFORM_TOKENS: OverlayStyleTokens = {
  line: {
    activeRangeBackground: 'rgba(37, 99, 235, 0.18)',
    inactiveRangeBackground: 'rgba(37, 99, 235, 0.1)',
    lineStart: 'rgb(190, 18, 60)',
    lineEnd: 'rgb(29, 78, 216)',
    partialActive: 'rgb(180, 83, 9)',
    partialInactive: 'rgba(180, 83, 9, 0.78)',
    wordSeparatorActive: 'rgb(180, 83, 9)',
    wordSeparatorInactive: 'rgba(180, 83, 9, 0.78)',
    activeWordText: 'rgba(3, 7, 18, 0.98)',
    inactiveWordText: 'rgba(3, 7, 18, 0.82)',
    wordTextShadow:
      '0 0 1px rgba(255, 255, 255, 1), 0 0 3px rgba(255, 255, 255, 0.96), 0 1px 2px rgba(255, 255, 255, 0.88)',
    boundaryShadow: 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.92))',
  },
  grid: {
    barStroke: 'rgba(15, 23, 42, 0.72)',
    beatStroke: 'rgba(180, 83, 9, 0.68)',
    subdivisionStroke: 'rgba(180, 83, 9, 0.5)',
    previewLine: 'rgba(180, 83, 9, 0.98)',
    previewBackground: 'rgba(255, 255, 255, 0.86)',
    previewText: 'rgba(15, 23, 42, 0.96)',
    previewShadow: '0 1px 3px rgba(15, 23, 42, 0.24)',
  },
  playhead: {
    color: 'rgb(190, 18, 60)',
    shadow: '0 0 0 1px rgba(255, 255, 255, 0.92), 0 0 5px rgba(15, 23, 42, 0.32)',
    markerShadow: 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.95))',
  },
}

const SPECTROGRAM_TOKENS: OverlayStyleTokens = {
  line: {
    activeRangeBackground: 'rgba(8, 13, 28, 0.5)',
    inactiveRangeBackground: 'rgba(8, 13, 28, 0.34)',
    lineStart: 'rgb(255, 79, 79)',
    lineEnd: 'rgb(125, 211, 252)',
    partialActive: 'rgba(255, 236, 153, 0.98)',
    partialInactive: 'rgba(255, 236, 153, 0.7)',
    wordSeparatorActive: 'rgba(255, 236, 153, 0.98)',
    wordSeparatorInactive: 'rgba(255, 236, 153, 0.7)',
    activeWordText: 'rgba(255, 255, 255, 0.98)',
    inactiveWordText: 'rgba(255, 255, 255, 0.78)',
    wordTextShadow: '0 1px 3px rgba(0, 0, 0, 0.95)',
    boundaryShadow: 'drop-shadow(0 0 3px rgba(0, 0, 0, 0.9))',
  },
  grid: {
    barStroke: 'rgba(255, 255, 255, 0.9)',
    beatStroke: 'rgba(255, 255, 255, 0.58)',
    subdivisionStroke: 'rgba(255, 255, 255, 0.32)',
    previewLine: 'rgba(255, 236, 153, 0.98)',
    previewBackground: 'rgba(0, 0, 0, 0.82)',
    previewText: 'rgba(255, 255, 255, 0.96)',
    previewShadow: '0 1px 5px rgba(0, 0, 0, 0.7)',
  },
  playhead: {
    color: 'rgb(255, 79, 79)',
    shadow: '0 0 0 1px rgba(0, 0, 0, 0.76), 0 0 7px rgba(255, 255, 255, 0.35)',
    markerShadow: 'drop-shadow(0 0 3px rgba(0, 0, 0, 0.86))',
  },
}

export function getOverlayStyleTokens(
  context: OverlayStyleContext = {},
): OverlayStyleTokens {
  if (context.viewMode === 'spectrogram') return SPECTROGRAM_TOKENS
  return context.theme === 'light' ? LIGHT_WAVEFORM_TOKENS : DARK_WAVEFORM_TOKENS
}
