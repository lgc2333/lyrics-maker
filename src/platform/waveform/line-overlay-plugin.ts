import BasePlugin from 'wavesurfer.js/dist/base-plugin.js'
import type { BasePluginEvents } from 'wavesurfer.js/dist/base-plugin.js'

import type { LyricLine } from '../../core/domain/project'

export interface LineOverlayOptions {
  outerContainer?: HTMLElement
}

export interface LineOverlayParams {
  lyrics: LyricLine[]
  activeLineId: string | null
}

export class LineOverlayPlugin extends BasePlugin<
  BasePluginEvents,
  LineOverlayOptions
> {
  private layer: HTMLDivElement | null = null
  private params: LineOverlayParams = {
    lyrics: [],
    activeLineId: null,
  }

  private visibleStart = 0
  private visibleEnd = 0

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
        this._draw()
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
  ): HTMLDivElement {
    const el = document.createElement('div')
    el.dataset.testid = testId
    Object.assign(el.style, {
      position: 'absolute',
      top: '0',
      left: `${leftPx}px`,
      width: '0',
      height: '100%',
      borderLeft: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
      pointerEvents: 'none',
    })
    return el
  }

  private _intersects(start: number, end: number): boolean {
    const buffer = 0.5
    return end >= this.visibleStart - buffer && start <= this.visibleEnd + buffer
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

    for (const line of this.params.lyrics) {
      if (line.startTime === undefined) continue
      const lastWord = line.words[line.words.length - 1]
      const lineEnd = lastWord?.endTime
      if (lineEnd === undefined) continue
      if (!this._intersects(line.startTime, lineEnd)) continue

      const isActive = line.id === this.params.activeLineId
      const x1 = line.startTime * pxPerSec
      const x2 = lineEnd * pxPerSec
      const range = document.createElement('div')
      range.dataset.testid = `lyric-range-${line.id}`
      Object.assign(range.style, {
        position: 'absolute',
        top: '0',
        left: `${x1}px`,
        width: `${Math.max(0, x2 - x1)}px`,
        height: '100%',
        background: isActive
          ? 'rgba(100, 180, 255, 0.12)'
          : 'rgba(100, 180, 255, 0.05)',
        pointerEvents: 'none',
      })

      range.appendChild(
        this._createBoundary(`line-start-${line.id}`, 0, 'rgba(255, 80, 80, 0.8)'),
      )
      range.appendChild(
        this._createBoundary(
          `line-end-${line.id}`,
          Math.max(0, x2 - x1),
          'rgba(100, 180, 255, 0.8)',
        ),
      )

      let prevWordEnd = line.startTime
      for (let i = 0; i < line.words.length; i++) {
        const word = line.words[i]
        const wordStart = prevWordEnd
        const wordEnd = word.endTime
        if (wordEnd === undefined) break

        const wordX1 = wordStart * pxPerSec - x1
        const wordX2 = wordEnd * pxPerSec - x1
        const wordWidth = wordX2 - wordX1

        if (i > 0) {
          range.appendChild(
            this._createBoundary(
              `word-separator-${word.id}`,
              wordX1,
              isActive ? 'rgba(255, 214, 80, 0.85)' : 'rgba(255, 214, 80, 0.45)',
              true,
            ),
          )
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
            color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
            textShadow: '0 0 2px rgba(0,0,0,0.7)',
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
