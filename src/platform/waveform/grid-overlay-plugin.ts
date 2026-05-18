import { BasePlugin, type BasePluginEvents } from 'wavesurfer.js'

import { getBeatGridLines } from '../../core/timing/timing-engine'
import type { TimingPoint } from '../../core/domain/project'

export interface GridOverlayParams {
  timingPoints: TimingPoint[]
  currentTime: number
  divisor: number
  triplets: boolean
}

export class GridOverlayPlugin extends BasePlugin<BasePluginEvents, object> {
  private canvas: HTMLCanvasElement | null = null
  private params: GridOverlayParams = {
    timingPoints: [],
    currentTime: 0,
    divisor: 4,
    triplets: false,
  }
  private visibleStart = 0
  private visibleEnd = 0

  static create(): GridOverlayPlugin {
    return new GridOverlayPlugin({})
  }

  protected onInit(): void {
    const ws = this.wavesurfer!
    const wrapper = ws.getWrapper()
    const scrollContainer = wrapper.parentElement

    if (!scrollContainer) return

    this.canvas = document.createElement('canvas')
    Object.assign(this.canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '2',
    })
    scrollContainer.style.position = 'relative'
    scrollContainer.appendChild(this.canvas)

    this.subscriptions.push(
      ws.on('scroll', (start: number, end: number) => {
        this.visibleStart = start
        this.visibleEnd = end
        this._draw()
      }),
      ws.on('redraw', () => this._draw()),
      ws.on('zoom', () => this._draw()),
      ws.on('ready', () => this._draw()),
    )
  }

  update(params: GridOverlayParams): void {
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

    const lines = getBeatGridLines(
      this.params.timingPoints,
      this.params.divisor,
      this.params.triplets,
      Math.max(0, this.visibleStart - 0.5),
      Math.min(duration, this.visibleEnd + 0.5),
    )

    for (const line of lines) {
      const x = Math.round((line.time - this.visibleStart) * pxPerSec) + 0.5
      if (x < -2 || x > w + 2) continue

      if (line.type === 'bar') {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'
        ctx.lineWidth = 2
      } else if (line.type === 'beat') {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 1
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'
        ctx.lineWidth = 1
      }

      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }

    // Draw playhead
    const px = Math.round((this.params.currentTime - this.visibleStart) * pxPerSec) + 0.5
    if (px >= -2 && px <= w + 2) {
      ctx.strokeStyle = 'rgba(255,50,50,0.9)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(px, 0)
      ctx.lineTo(px, h)
      ctx.stroke()
    }
  }

  destroy(): void {
    this.canvas?.remove()
    this.canvas = null
    super.destroy()
  }
}
