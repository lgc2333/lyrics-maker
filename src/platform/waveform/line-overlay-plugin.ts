import BasePlugin from 'wavesurfer.js/dist/base-plugin.js'
import type { BasePluginEvents } from 'wavesurfer.js/dist/base-plugin.js'

import type { LyricLine } from '../../core/domain/project'

export interface LineOverlayOptions {
  outerContainer?: HTMLElement
}

export interface LineOverlayParams {
  lyrics: LyricLine[]
  activeLineId: string | null
  currentTime: number
}

export class LineOverlayPlugin extends BasePlugin<
  BasePluginEvents,
  LineOverlayOptions
> {
  private canvas: HTMLCanvasElement | null = null
  private params: LineOverlayParams = {
    lyrics: [],
    activeLineId: null,
    currentTime: 0,
  }

  private visibleStart = 0
  private visibleEnd = 0

  static create(options?: LineOverlayOptions): LineOverlayPlugin {
    return new LineOverlayPlugin(options ?? {})
  }

  protected onInit(): void {
    const ws = this.wavesurfer!
    const wrapper = ws.getWrapper()
    const scrollContainer = wrapper.parentElement

    const containerEl: HTMLElement =
      this.options.outerContainer ??
      (() => {
        const root = wrapper.getRootNode()
        const host = (root as ShadowRoot).host
        return (host as HTMLElement | undefined) ?? wrapper
      })()

    this.canvas = document.createElement('canvas')
    Object.assign(this.canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '3',
    })
    containerEl.style.position = 'relative'
    containerEl.appendChild(this.canvas)

    this.subscriptions.push(
      ws.on('scroll', (start: number, end: number) => {
        this.visibleStart = start
        this.visibleEnd = end
        this._draw()
      }),
      ws.on('redraw', () => this._draw()),
      ws.on('zoom', () => {
        if (scrollContainer) {
          const duration = ws.getDuration()
          if (wrapper.scrollWidth > 0 && duration > 0) {
            const pxPerSec = wrapper.scrollWidth / duration
            this.visibleStart = scrollContainer.scrollLeft / pxPerSec
            this.visibleEnd =
              (scrollContainer.scrollLeft + scrollContainer.clientWidth) / pxPerSec
          }
        }
        this._draw()
      }),
      ws.on('ready', () => {
        if (scrollContainer) {
          const duration = ws.getDuration()
          if (wrapper.scrollWidth > 0 && duration > 0) {
            const pxPerSec = wrapper.scrollWidth / duration
            this.visibleStart = scrollContainer.scrollLeft / pxPerSec
            this.visibleEnd =
              (scrollContainer.scrollLeft + scrollContainer.clientWidth) / pxPerSec
          }
        }
        this._draw()
      }),
    )
  }

  update(params: LineOverlayParams): void {
    this.params = params
    this._draw()
  }

  private _draw(): void {
    if (!this.canvas || !this.wavesurfer) return
    const duration = this.wavesurfer.getDuration()
    if (duration <= 0) return

    const container = this.canvas.parentElement
    if (!container) return
    const w = container.clientWidth
    const h = container.clientHeight
    if (w <= 0 || h <= 0) return

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }

    const visibleDuration = this.visibleEnd - this.visibleStart
    if (visibleDuration <= 0) return

    const pxPerSec = w / visibleDuration
    const ctx = this.canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, w, h)

    for (const line of this.params.lyrics) {
      if (line.startTime === undefined) continue
      const lastWord = line.words[line.words.length - 1]
      const lineEnd = lastWord?.endTime
      if (lineEnd === undefined) continue

      const x1 = (line.startTime - this.visibleStart) * pxPerSec
      const x2 = (lineEnd - this.visibleStart) * pxPerSec
      if (x2 < 0 || x1 > w) continue

      const isActive = line.id === this.params.activeLineId
      const clampedX1 = Math.max(0, x1)
      const clampedX2 = Math.min(w, x2)

      // Sentence background fill
      ctx.fillStyle = isActive
        ? 'rgba(100, 180, 255, 0.12)'
        : 'rgba(100, 180, 255, 0.05)'
      ctx.fillRect(clampedX1, 0, clampedX2 - clampedX1, h)

      // Sentence start boundary — red solid line
      if (x1 >= 0 && x1 <= w) {
        ctx.strokeStyle = 'rgba(255, 80, 80, 0.8)'
        ctx.lineWidth = 2
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(Math.round(x1) + 0.5, 0)
        ctx.lineTo(Math.round(x1) + 0.5, h)
        ctx.stroke()
      }

      // Sentence end boundary — blue solid line
      if (x2 >= 0 && x2 <= w) {
        ctx.strokeStyle = 'rgba(100, 180, 255, 0.8)'
        ctx.lineWidth = 2
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(Math.round(x2) + 0.5, 0)
        ctx.lineTo(Math.round(x2) + 0.5, h)
        ctx.stroke()
      }

      // Word separator lines (dashed) and word text labels
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)'
      ctx.shadowBlur = 2
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      let prevWordEnd = line.startTime
      for (let i = 0; i < line.words.length; i++) {
        const word = line.words[i]
        const wordStart = prevWordEnd
        const wordEnd = word.endTime

        // Word separator dashed line (skip first word — that's the sentence start)
        if (i > 0) {
          const sx = Math.round((wordStart - this.visibleStart) * pxPerSec) + 0.5
          if (sx >= 0 && sx <= w) {
            ctx.strokeStyle = isActive
              ? 'rgba(255, 255, 255, 0.5)'
              : 'rgba(255, 255, 255, 0.25)'
            ctx.lineWidth = 1
            ctx.setLineDash([4, 3])
            ctx.beginPath()
            ctx.moveTo(sx, 0)
            ctx.lineTo(sx, h)
            ctx.stroke()
          }
        }

        // Word text label
        if (wordEnd !== undefined) {
          const textX1 = (wordStart - this.visibleStart) * pxPerSec
          const textX2 = (wordEnd - this.visibleStart) * pxPerSec
          const textWidth = textX2 - textX1
          const fontSize = Math.max(10, Math.min(14, textWidth * 0.6))
          ctx.font = `${fontSize}px sans-serif`
          ctx.fillStyle = isActive
            ? 'rgba(255, 255, 255, 0.9)'
            : 'rgba(255, 255, 255, 0.5)'
          const centerX = (textX1 + textX2) / 2
          const displayText = word.text.trimEnd()
          if (textWidth > 8) {
            ctx.fillText(displayText, centerX, h * 0.15, textWidth - 4)
          }
          prevWordEnd = wordEnd
        } else {
          break
        }
      }
      ctx.restore()
    }
  }

  destroy(): void {
    this.canvas?.remove()
    this.canvas = null
    super.destroy()
  }
}
