import BasePlugin from 'wavesurfer.js/dist/base-plugin.js'
import type { BasePluginEvents } from 'wavesurfer.js/dist/base-plugin.js'

import type { LyricLine } from '../../core/domain/project'
import { getOverlayStyleTokens } from './overlay-style-tokens'
import type { OverlayStyleContext } from './overlay-style-tokens'

export interface LineOverlayOptions extends OverlayStyleContext {
  outerContainer?: HTMLElement
}

export interface LineOverlayParams extends OverlayStyleContext {
  lyrics: LyricLine[]
  activeLineId: string | null
  activeWordIndex?: number
}

export class LineOverlayPlugin extends BasePlugin<
  BasePluginEvents,
  LineOverlayOptions
> {
  private layer: HTMLDivElement | null = null
  private params: LineOverlayParams = {
    lyrics: [],
    activeLineId: null,
    activeWordIndex: 0,
  }

  private visibleStart = 0
  private visibleEnd = 0
  private renderedStart = 0
  private renderedEnd = 0
  private hasRenderedRange = false

  static create(options?: LineOverlayOptions): LineOverlayPlugin {
    return new LineOverlayPlugin(options ?? {})
  }

  protected onInit(): void {
    const ws = this.wavesurfer!
    const wrapper = ws.getWrapper()

    wrapper.style.position = 'relative'
    this.layer = document.createElement('div')
    this.layer.dataset.testid = 'timeline-lyrics'
    Object.assign(this.layer.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '3',
      overflow: 'visible',
    })
    wrapper.appendChild(this.layer)

    this.subscriptions.push(
      ws.on('scroll', () => {
        this._refreshVisibleRange()
        if (!this._isVisibleRangeCovered()) this._draw()
      }),
      ws.on('redraw', () => this._draw()),
      ws.on('zoom', () => {
        this._refreshVisibleRange()
        this._draw()
      }),
      ws.on('ready', () => {
        this._refreshVisibleRange()
        this._draw()
      }),
    )
  }

  update(params: LineOverlayParams): void {
    this.params = params
    this._draw()
  }

  private _refreshVisibleRange(): void {
    if (!this.wavesurfer) return
    const wrapper = this.wavesurfer.getWrapper()
    const scrollContainer = wrapper.parentElement
    const duration = this.wavesurfer.getDuration()
    if (!scrollContainer || wrapper.scrollWidth <= 0 || duration <= 0) {
      this.visibleStart = 0
      this.visibleEnd = 0
      return
    }
    const pxPerSec = wrapper.scrollWidth / duration
    this.visibleStart = scrollContainer.scrollLeft / pxPerSec
    this.visibleEnd =
      (scrollContainer.scrollLeft + scrollContainer.clientWidth) / pxPerSec
  }

  private _createBoundary(
    testId: string,
    leftPx: number,
    color: string,
    dashed = false,
    markers = false,
    markerSide: 'right' | 'left' = 'right',
    shadow = '',
  ): HTMLDivElement {
    const el = document.createElement('div')
    el.dataset.testid = testId
    Object.assign(el.style, {
      position: 'absolute',
      top: '0',
      left: `${leftPx}px`,
      width: '0',
      height: '100%',
      pointerEvents: 'none',
    })
    const line = document.createElement('div')
    line.dataset.testid = `${testId}-line`
    Object.assign(line.style, {
      position: 'absolute',
      top: '0',
      left: '-1px',
      width: '2px',
      height: '100%',
      borderLeft: dashed ? `2px dashed ${color}` : '',
      background: dashed ? '' : color,
      pointerEvents: 'none',
      filter: shadow,
    })
    el.appendChild(line)
    if (markers) {
      el.append(
        this._createBoundaryMarker(
          `${testId}-marker-top`,
          color,
          'top',
          markerSide,
          shadow,
        ),
        this._createBoundaryMarker(
          `${testId}-marker-bottom`,
          color,
          'bottom',
          markerSide,
          shadow,
        ),
      )
    }
    return el
  }

  private _createBoundaryMarker(
    testId: string,
    color: string,
    edge: 'top' | 'bottom',
    side: 'right' | 'left',
    shadow: string,
  ): HTMLDivElement {
    const markerSize = 8
    const topClip =
      side === 'right'
        ? 'polygon(0px 0px, 100% 0px, 0px 100%)'
        : 'polygon(0px 0px, 100% 0px, 100% 100%)'
    const bottomClip =
      side === 'right'
        ? 'polygon(0px 0px, 100% 100%, 0px 100%)'
        : 'polygon(100% 0px, 100% 100%, 0px 100%)'
    const marker = document.createElement('div')
    marker.dataset.testid = testId
    Object.assign(marker.style, {
      position: 'absolute',
      left: side === 'right' ? '1px' : `${-markerSize - 1}px`,
      width: `${markerSize}px`,
      height: `${markerSize}px`,
      background: color,
      clipPath: edge === 'top' ? topClip : bottomClip,
      pointerEvents: 'none',
      filter: shadow,
      ...(edge === 'top' ? { top: '0' } : { bottom: '0' }),
    })
    return marker
  }

  private _intersects(start: number, end: number): boolean {
    return end >= this.renderedStart && start <= this.renderedEnd
  }

  private _isVisibleRangeCovered(): boolean {
    return (
      this.hasRenderedRange &&
      this.visibleStart >= this.renderedStart &&
      this.visibleEnd <= this.renderedEnd
    )
  }

  private _getLineRenderState(line: LyricLine): {
    endTime: number
    finalWordIsTimed: boolean
  } | null {
    if (line.startTime === undefined) return null

    let endTime: number | undefined

    for (const word of line.words) {
      if (word.endTime === undefined) {
        continue
      }
      endTime = word.endTime
    }

    if (endTime === undefined) return null
    return {
      endTime,
      finalWordIsTimed: line.words.at(-1)?.endTime !== undefined,
    }
  }

  private _draw(): void {
    if (!this.layer || !this.wavesurfer) return
    this.layer.replaceChildren()

    const duration = this.wavesurfer.getDuration()
    if (duration <= 0) return

    const wrapper = this.wavesurfer.getWrapper()
    if (wrapper.scrollWidth <= 0) return

    const visibleDuration = this.visibleEnd - this.visibleStart
    if (visibleDuration <= 0) return

    const pxPerSec = wrapper.scrollWidth / duration
    const tokens = getOverlayStyleTokens({
      theme: this.params.theme ?? this.options.theme,
      viewMode: this.params.viewMode ?? this.options.viewMode,
    }).line
    const renderBuffer = Math.max(0.5, visibleDuration / 2)
    this.renderedStart = Math.max(0, this.visibleStart - renderBuffer)
    this.renderedEnd = Math.min(duration, this.visibleEnd + renderBuffer)
    this.hasRenderedRange = true

    for (const line of this.params.lyrics) {
      if (line.startTime === undefined) continue
      const lineState = this._getLineRenderState(line)
      if (!lineState) continue
      if (!this._intersects(line.startTime, lineState.endTime)) continue

      const isActive = line.id === this.params.activeLineId
      const x1 = line.startTime * pxPerSec
      const x2 = lineState.endTime * pxPerSec
      const range = document.createElement('div')
      range.dataset.testid = `lyric-range-${line.id}`
      Object.assign(range.style, {
        position: 'absolute',
        top: '0',
        left: `${x1}px`,
        width: `${Math.max(0, x2 - x1)}px`,
        height: '100%',
        background: isActive
          ? tokens.activeRangeBackground
          : tokens.inactiveRangeBackground,
        pointerEvents: 'none',
      })

      range.appendChild(
        this._createBoundary(
          `line-start-${line.id}`,
          0,
          tokens.lineStart,
          false,
          true,
          'right',
          tokens.boundaryShadow,
        ),
      )
      if (lineState.finalWordIsTimed) {
        range.appendChild(
          this._createBoundary(
            `line-end-${line.id}`,
            Math.max(0, x2 - x1),
            tokens.lineEnd,
            false,
            true,
            'left',
            tokens.boundaryShadow,
          ),
        )
      } else {
        range.appendChild(
          this._createBoundary(
            `partial-line-end-${line.id}`,
            Math.max(0, x2 - x1),
            isActive ? tokens.partialActive : tokens.partialInactive,
            true,
            true,
            'left',
            tokens.boundaryShadow,
          ),
        )
      }

      let prevWordEnd = line.startTime
      for (let i = 0; i < line.words.length; i++) {
        const word = line.words[i]
        const wordStart = prevWordEnd
        const wordEnd = word.endTime
        if (wordEnd === undefined) continue

        const wordX1 = wordStart * pxPerSec - x1
        const wordX2 = wordEnd * pxPerSec - x1
        const wordWidth = wordX2 - wordX1
        const selectedWordStart = i === 0 ? line.startTime : line.words[i - 1]?.endTime
        const isSelectedWord =
          isActive &&
          this.params.activeWordIndex === i + 1 &&
          selectedWordStart !== undefined &&
          wordWidth > 0

        if (i > 0) {
          range.appendChild(
            this._createBoundary(
              `word-separator-${word.id}`,
              wordX1,
              isActive ? tokens.wordSeparatorActive : tokens.wordSeparatorInactive,
              true,
              false,
              'right',
              tokens.boundaryShadow,
            ),
          )
        }

        if (isSelectedWord && this._intersects(wordStart, wordEnd)) {
          const highlight = document.createElement('div')
          highlight.dataset.testid = `selected-word-range-${word.id}`
          Object.assign(highlight.style, {
            position: 'absolute',
            top: '0',
            left: `${wordX1}px`,
            width: `${wordWidth}px`,
            height: '100%',
            background: tokens.selectedWordBackground,
            pointerEvents: 'none',
          })
          range.appendChild(highlight)
        }

        if (wordWidth > 8 && this._intersects(wordStart, wordEnd)) {
          const label = document.createElement('div')
          label.dataset.testid = `word-label-${word.id}`
          label.textContent = word.text.trimEnd()
          Object.assign(label.style, {
            position: 'absolute',
            top: '15%',
            left: `${wordX1}px`,
            width: `${wordWidth}px`,
            overflow: 'hidden',
            textOverflow: 'clip',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            fontSize: `${Math.max(10, Math.min(14, wordWidth * 0.6))}px`,
            color: isActive ? tokens.activeWordText : tokens.inactiveWordText,
            textShadow: tokens.wordTextShadow,
          })
          range.appendChild(label)
        }

        prevWordEnd = wordEnd
      }

      this.layer.appendChild(range)
    }
  }

  destroy(): void {
    this.layer?.remove()
    this.layer = null
    super.destroy()
  }
}
