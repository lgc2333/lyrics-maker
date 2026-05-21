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

      // Sentence block
      const isActive = line.id === this.params.activeLineId
      ctx.fillStyle = isActive
        ? 'rgba(100, 180, 255, 0.15)'
        : 'rgba(100, 180, 255, 0.07)'
      ctx.fillRect(Math.max(0, x1), 0, Math.min(w, x2) - Math.max(0, x1), h)

      // Word separator lines
      for (const word of line.words) {
        if (word.endTime === undefined) continue
        const wx = Math.round((word.endTime - this.visibleStart) * pxPerSec) + 0.5
        if (wx < 0 || wx > w) continue
        ctx.strokeStyle = isActive
          ? 'rgba(100, 180, 255, 0.6)'
          : 'rgba(100, 180, 255, 0.3)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(wx, 0)
        ctx.lineTo(wx, h)
        ctx.stroke()
      }
    }
  }

  destroy(): void {
    this.canvas?.remove()
    this.canvas = null
    super.destroy()
  }
}
