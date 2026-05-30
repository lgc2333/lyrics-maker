import BasePlugin from 'wavesurfer.js/dist/base-plugin.js'
import type { BasePluginEvents } from 'wavesurfer.js/dist/base-plugin.js'

import type { LyricLine } from '../../core/domain/project'
import type { BoundaryDragIntent } from '../../core/lyrics/boundary-bounds'
import { getOverlayStyleTokens } from './overlay-style-tokens'
import type { OverlayStyleContext } from './overlay-style-tokens'

const EDGE_SCROLL_ZONE_PX = 40
const MAX_SCROLL_SPEED_PX_PER_FRAME = 12

export interface LineOverlayOptions extends OverlayStyleContext {
  outerContainer?: HTMLElement
}

export interface DragPreview {
  intent: BoundaryDragIntent
  time: number
}

export interface LineOverlayParams extends OverlayStyleContext {
  lyrics: LyricLine[]
  activeLineId: string | null
  activeWordIndex?: number
  duration?: number
  dragPreview?: DragPreview
}

interface LineOverlayEvents extends BasePluginEvents {
  boundaryDragStart: [{ intent: BoundaryDragIntent }]
  boundaryDragMove: [{ intent: BoundaryDragIntent; rawTime: number }]
  boundaryDragEnd: [{ intent: BoundaryDragIntent; rawTime: number }]
  boundaryDragCancel: [{ intent: BoundaryDragIntent }]
}

export class LineOverlayPlugin extends BasePlugin<
  LineOverlayEvents,
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
  private dragIntent: BoundaryDragIntent | null = null
  private dragPointerId: number | null = null
  private dragHandle: HTMLElement | null = null
  private lastClientX = 0
  private edgeScrollRafId: number | null = null
  private isWindowPointerTracking = false

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

    window.addEventListener('keydown', this._handleWindowKeydown)
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

  private _createBoundaryHandle(
    testId: string,
    leftPx: number,
    intent: BoundaryDragIntent,
  ): HTMLDivElement {
    const handle = document.createElement('div')
    handle.dataset.testid = testId
    Object.assign(handle.style, {
      position: 'absolute',
      top: '0',
      left: `${leftPx - 5}px`,
      width: '10px',
      height: '100%',
      pointerEvents: 'auto',
      cursor: 'ew-resize',
      zIndex: '6',
      background: 'transparent',
    })
    handle.addEventListener('pointerdown', (event) => {
      this._handlePointerDown(event, intent, handle)
    })
    return handle
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
    carrierWordId: string
  } | null {
    if (line.startTime === undefined) return null

    let endTime: number | undefined
    let carrierWordId: string | undefined

    for (const word of line.words) {
      if (word.endTime === undefined) {
        continue
      }
      endTime = word.endTime
      carrierWordId = word.id
    }

    if (endTime === undefined || carrierWordId === undefined) return null
    return {
      endTime,
      carrierWordId,
      finalWordIsTimed: line.words.at(-1)?.endTime !== undefined,
    }
  }

  private _getPreviewTime(intent: BoundaryDragIntent): number | undefined {
    const preview = this.params.dragPreview
    if (!preview) return undefined
    if (preview.intent.kind !== intent.kind) return undefined
    if (preview.intent.lineId !== intent.lineId) return undefined
    if ('wordId' in preview.intent || 'wordId' in intent) {
      if (!('wordId' in preview.intent) || !('wordId' in intent)) return undefined
      if (preview.intent.wordId !== intent.wordId) return undefined
    }
    return preview.time
  }

  private _getEffectiveLineStart(line: LyricLine): number {
    return (
      this._getPreviewTime({ kind: 'line-start', lineId: line.id }) ??
      line.startTime ??
      0
    )
  }

  private _getEffectiveWordEnd(line: LyricLine, wordId: string): number | undefined {
    const word = line.words.find((item) => item.id === wordId)
    if (!word || word.endTime === undefined) return undefined
    const preview = this._getPreviewTime({
      kind: word.id === line.words.at(-1)?.id ? 'line-end' : 'word-separator',
      lineId: line.id,
      wordId,
    })
    return preview ?? word.endTime
  }

  private _getEffectiveLineEnd(
    line: LyricLine,
    state: {
      endTime: number
      carrierWordId: string
    },
  ): number {
    const lineEndPreview = this._getPreviewTime({
      kind: 'line-end',
      lineId: line.id,
      wordId: state.carrierWordId,
    })
    const separatorPreview = this._getPreviewTime({
      kind: 'word-separator',
      lineId: line.id,
      wordId: state.carrierWordId,
    })
    return lineEndPreview ?? separatorPreview ?? state.endTime
  }

  private _createDragPreviewLine(leftPx: number): HTMLDivElement {
    const preview = document.createElement('div')
    preview.dataset.testid = 'boundary-handle-drag-preview'
    Object.assign(preview.style, {
      position: 'absolute',
      top: '0',
      left: `${leftPx}px`,
      width: '2px',
      height: '100%',
      background: 'rgba(255, 255, 255, 0.9)',
      boxShadow: '0 0 8px rgba(255, 255, 255, 0.75)',
      pointerEvents: 'none',
      zIndex: '3',
    })
    return preview
  }

  private _clientXToRawTime(clientX: number): number {
    if (!this.wavesurfer) return 0
    const wrapper = this.wavesurfer.getWrapper()
    const duration = this.params.duration ?? this.wavesurfer.getDuration()
    const pxPerSec = duration > 0 ? wrapper.scrollWidth / duration : 0
    if (pxPerSec <= 0) return 0

    const contentX = clientX - wrapper.getBoundingClientRect().left
    return Math.max(0, Math.min(duration, contentX / pxPerSec))
  }

  private _handlePointerDown(
    event: PointerEvent,
    intent: BoundaryDragIntent,
    handle: HTMLElement,
  ): void {
    event.preventDefault()
    event.stopPropagation()
    this.dragIntent = intent
    this.dragPointerId = event.pointerId
    this.dragHandle = handle
    this.lastClientX = event.clientX
    try {
      handle.setPointerCapture?.(event.pointerId)
    } catch {
      // Window listeners below keep drag reliable when capture is unavailable.
    }
    this._startWindowPointerTracking()
    this.emit('boundaryDragStart', { intent })
    this._updateEdgeScroll(event.clientX)
  }

  private _handlePointerMove(event: PointerEvent): void {
    if (!this.dragIntent || event.pointerId !== this.dragPointerId) return
    event.preventDefault()
    this.lastClientX = event.clientX
    this.emit('boundaryDragMove', {
      intent: this.dragIntent,
      rawTime: this._clientXToRawTime(event.clientX),
    })
    this._updateEdgeScroll(event.clientX)
  }

  private _handlePointerUp(event: PointerEvent): void {
    if (!this.dragIntent || event.pointerId !== this.dragPointerId) return
    event.preventDefault()
    const intent = this.dragIntent
    this.emit('boundaryDragEnd', {
      intent,
      rawTime: this._clientXToRawTime(event.clientX),
    })
    this._finishDrag(false)
  }

  private readonly _handleWindowKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.dragIntent) return
    event.preventDefault()
    this._cancelDrag()
  }

  private readonly _handleWindowPointerMove = (event: PointerEvent): void => {
    this._handlePointerMove(event)
  }

  private readonly _handleWindowPointerUp = (event: PointerEvent): void => {
    this._handlePointerUp(event)
  }

  private readonly _handleWindowPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointerId) return
    this._cancelDrag()
  }

  private _startWindowPointerTracking(): void {
    if (this.isWindowPointerTracking) return
    window.addEventListener('pointermove', this._handleWindowPointerMove, true)
    window.addEventListener('pointerup', this._handleWindowPointerUp, true)
    window.addEventListener('pointercancel', this._handleWindowPointerCancel, true)
    this.isWindowPointerTracking = true
  }

  private _stopWindowPointerTracking(): void {
    if (!this.isWindowPointerTracking) return
    window.removeEventListener('pointermove', this._handleWindowPointerMove, true)
    window.removeEventListener('pointerup', this._handleWindowPointerUp, true)
    window.removeEventListener('pointercancel', this._handleWindowPointerCancel, true)
    this.isWindowPointerTracking = false
  }

  private _cancelDrag(): void {
    if (!this.dragIntent) return
    const intent = this.dragIntent
    this.emit('boundaryDragCancel', { intent })
    this._finishDrag(false)
  }

  private _finishDrag(emitCancel: boolean): void {
    if (emitCancel) this._cancelDrag()
    this._stopEdgeScroll()
    this._stopWindowPointerTracking()
    if (this.dragHandle && this.dragPointerId !== null) {
      try {
        this.dragHandle.releasePointerCapture?.(this.dragPointerId)
      } catch {
        // Capture may already be gone if preview redraw replaced the handle.
      }
    }
    this.dragIntent = null
    this.dragPointerId = null
    this.dragHandle = null
  }

  private _updateEdgeScroll(clientX: number): void {
    if (!this.wavesurfer) return
    const wrapper = this.wavesurfer.getWrapper()
    const scrollContainer = wrapper.parentElement
    if (!scrollContainer) return

    const rect = scrollContainer.getBoundingClientRect()
    const distanceLeft = clientX - rect.left
    const distanceRight = rect.right - clientX
    if (distanceLeft >= EDGE_SCROLL_ZONE_PX && distanceRight >= EDGE_SCROLL_ZONE_PX) {
      this._stopEdgeScroll()
      return
    }

    if (this.edgeScrollRafId === null) {
      this.edgeScrollRafId = requestAnimationFrame(() => this._tickEdgeScroll())
    }
  }

  private _tickEdgeScroll(): void {
    this.edgeScrollRafId = null
    if (!this.dragIntent || !this.wavesurfer) return

    const wrapper = this.wavesurfer.getWrapper()
    const scrollContainer = wrapper.parentElement
    if (!scrollContainer) return

    const rect = scrollContainer.getBoundingClientRect()
    const distanceLeft = this.lastClientX - rect.left
    const distanceRight = rect.right - this.lastClientX
    let delta = 0
    if (distanceLeft < EDGE_SCROLL_ZONE_PX) {
      delta =
        -MAX_SCROLL_SPEED_PX_PER_FRAME *
        (1 - Math.max(0, distanceLeft) / EDGE_SCROLL_ZONE_PX)
    } else if (distanceRight < EDGE_SCROLL_ZONE_PX) {
      delta =
        MAX_SCROLL_SPEED_PX_PER_FRAME *
        (1 - Math.max(0, distanceRight) / EDGE_SCROLL_ZONE_PX)
    }

    if (delta === 0) return
    scrollContainer.scrollLeft += delta
    this.emit('boundaryDragMove', {
      intent: this.dragIntent,
      rawTime: this._clientXToRawTime(this.lastClientX),
    })
    this.edgeScrollRafId = requestAnimationFrame(() => this._tickEdgeScroll())
  }

  private _stopEdgeScroll(): void {
    if (this.edgeScrollRafId === null) return
    cancelAnimationFrame(this.edgeScrollRafId)
    this.edgeScrollRafId = null
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
      const effectiveLineStart = this._getEffectiveLineStart(line)
      const effectiveLineEnd = this._getEffectiveLineEnd(line, lineState)
      const x1 = effectiveLineStart * pxPerSec
      const x2 = effectiveLineEnd * pxPerSec
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
      range.appendChild(
        this._createBoundaryHandle(`boundary-handle-line-start-${line.id}`, 0, {
          kind: 'line-start',
          lineId: line.id,
        }),
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
        range.appendChild(
          this._createBoundaryHandle(
            `boundary-handle-line-end-${line.id}`,
            Math.max(0, x2 - x1),
            {
              kind: 'line-end',
              lineId: line.id,
              wordId: lineState.carrierWordId,
            },
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
        range.appendChild(
          this._createBoundaryHandle(
            `boundary-handle-word-separator-${lineState.carrierWordId}`,
            Math.max(0, x2 - x1),
            {
              kind: 'word-separator',
              lineId: line.id,
              wordId: lineState.carrierWordId,
            },
          ),
        )
      }

      const preview = this.params.dragPreview
      if (preview?.intent.lineId === line.id) {
        range.appendChild(this._createDragPreviewLine(preview.time * pxPerSec - x1))
      }

      let prevWordEnd = effectiveLineStart
      for (let i = 0; i < line.words.length; i++) {
        const word = line.words[i]
        const wordStart = prevWordEnd
        const wordEnd = this._getEffectiveWordEnd(line, word.id)
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
          const previousWord = line.words[i - 1]
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
          if (previousWord?.endTime !== undefined) {
            range.appendChild(
              this._createBoundaryHandle(
                `boundary-handle-word-separator-${previousWord.id}`,
                wordX1,
                {
                  kind: 'word-separator',
                  lineId: line.id,
                  wordId: previousWord.id,
                },
              ),
            )
          }
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
    this._finishDrag(false)
    window.removeEventListener('keydown', this._handleWindowKeydown)
    this.layer?.remove()
    this.layer = null
    super.destroy()
  }
}
