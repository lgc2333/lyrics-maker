import BasePlugin from 'wavesurfer.js/dist/base-plugin.js'
import type { BasePluginEvents } from 'wavesurfer.js/dist/base-plugin.js'

import type { TimingPoint } from '../../core/domain/project'
import { getBeatGridLines } from '../../core/timing/timing-engine'
import { formatTimestamp } from '../../core/utils/format-timestamp'

export interface GridOverlayOptions {
  /**
   * Kept for compatibility with older call sites. Grid content now attaches to
   * WaveSurfer's wrapper so it scrolls with the waveform/spectrogram.
   */
  outerContainer?: HTMLElement
}

export interface GridOverlayParams {
  timingPoints: TimingPoint[]
  divisor: number
  triplets: boolean
}

export class GridOverlayPlugin extends BasePlugin<
  BasePluginEvents,
  GridOverlayOptions
> {
  private svg: SVGSVGElement | null = null
  private preview: HTMLDivElement | null = null
  private previewLine: HTMLDivElement | null = null
  private previewLabel: HTMLDivElement | null = null
  private params: GridOverlayParams = {
    timingPoints: [],
    divisor: 4,
    triplets: false,
  }

  private visibleStart = 0
  private visibleEnd = 0
  private renderedStart = 0
  private renderedEnd = 0
  private hasRenderedRange = false

  static create(options?: GridOverlayOptions): GridOverlayPlugin {
    return new GridOverlayPlugin(options ?? {})
  }

  protected onInit(): void {
    const ws = this.wavesurfer!
    const wrapper = ws.getWrapper()

    wrapper.style.position = 'relative'
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    this.svg.dataset.testid = 'timeline-grid'
    Object.assign(this.svg.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '2',
      overflow: 'visible',
    })
    wrapper.appendChild(this.svg)

    this.preview = document.createElement('div')
    this.preview.dataset.testid = 'grid-time-preview'
    Object.assign(this.preview.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '4',
      overflow: 'visible',
      display: 'none',
    })

    this.previewLine = document.createElement('div')
    this.previewLine.dataset.testid = 'grid-time-preview-line'
    Object.assign(this.previewLine.style, {
      position: 'absolute',
      top: '0',
      width: '0',
      height: '100%',
      borderLeft: '1px solid rgba(255, 214, 80, 0.9)',
      pointerEvents: 'none',
    })

    this.previewLabel = document.createElement('div')
    this.previewLabel.dataset.testid = 'grid-time-preview-label'
    Object.assign(this.previewLabel.style, {
      position: 'absolute',
      top: '4px',
      transform: 'translateX(6px)',
      padding: '1px 5px',
      borderRadius: '4px',
      background: 'rgba(0, 0, 0, 0.72)',
      color: 'rgba(255, 255, 255, 0.92)',
      fontSize: '11px',
      lineHeight: '16px',
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    })

    this.preview.append(this.previewLine, this.previewLabel)
    wrapper.appendChild(this.preview)

    const onPointerMove = (event: PointerEvent) => {
      this._showPointerPreview(event)
    }
    const onPointerLeave = () => {
      this._hidePointerPreview()
    }
    wrapper.addEventListener('pointermove', onPointerMove)
    wrapper.addEventListener('pointerleave', onPointerLeave)

    this.subscriptions.push(
      () => wrapper.removeEventListener('pointermove', onPointerMove),
      () => wrapper.removeEventListener('pointerleave', onPointerLeave),
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

  update(params: GridOverlayParams): void {
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

  private _isVisibleRangeCovered(): boolean {
    return (
      this.hasRenderedRange &&
      this.visibleStart >= this.renderedStart &&
      this.visibleEnd <= this.renderedEnd
    )
  }

  private _showPointerPreview(event: PointerEvent): void {
    if (!this.preview || !this.previewLine || !this.previewLabel || !this.wavesurfer) {
      return
    }

    const wrapper = this.wavesurfer.getWrapper()
    const scrollContainer = wrapper.parentElement
    const duration = this.wavesurfer.getDuration()
    if (!scrollContainer || wrapper.scrollWidth <= 0 || duration <= 0) {
      this._hidePointerPreview()
      return
    }

    const pxPerSec = wrapper.scrollWidth / duration
    const pointerX =
      scrollContainer.scrollLeft +
      event.clientX -
      scrollContainer.getBoundingClientRect().left
    const clampedX = Math.max(0, Math.min(wrapper.scrollWidth, pointerX))
    const time = Math.max(0, Math.min(duration, clampedX / pxPerSec))

    this.preview.style.display = 'block'
    this.previewLine.style.left = `${clampedX}px`
    this.previewLabel.style.left = `${clampedX}px`
    this.previewLabel.textContent = formatTimestamp(time)
  }

  private _hidePointerPreview(): void {
    if (this.preview) this.preview.style.display = 'none'
  }

  private _draw(): void {
    if (!this.svg || !this.wavesurfer) return

    this.svg.replaceChildren()

    const duration = this.wavesurfer.getDuration()
    if (duration <= 0) return

    const visibleDuration = this.visibleEnd - this.visibleStart
    if (visibleDuration <= 0) return

    if (this.params.timingPoints.length === 0) return

    const wrapper = this.wavesurfer.getWrapper()
    if (wrapper.scrollWidth <= 0) return
    const pxPerSec = wrapper.scrollWidth / duration
    const renderBuffer = Math.max(0.5, visibleDuration / 2)
    const renderStart = Math.max(0, this.visibleStart - renderBuffer)
    const renderEnd = Math.min(duration, this.visibleEnd + renderBuffer)
    this.renderedStart = renderStart
    this.renderedEnd = renderEnd
    this.hasRenderedRange = true

    const lines = getBeatGridLines(
      this.params.timingPoints,
      this.params.divisor,
      this.params.triplets,
      renderStart,
      renderEnd,
    )

    let lastRenderedSubdivisionX = -Infinity
    for (const line of lines) {
      const x = line.time * pxPerSec
      if (line.type === 'subdivision') {
        if (x - lastRenderedSubdivisionX < 4) continue
        lastRenderedSubdivisionX = x
      }

      const el = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      el.setAttribute('x1', `${x}`)
      el.setAttribute('x2', `${x}`)
      el.setAttribute('y1', '0')
      el.setAttribute('y2', '100%')

      if (line.type === 'bar') {
        el.setAttribute('stroke', 'rgba(255,255,255,0.8)')
        el.setAttribute('stroke-width', '2')
      } else if (line.type === 'beat') {
        el.setAttribute('stroke', 'rgba(255,255,255,0.5)')
        el.setAttribute('stroke-width', '1')
      } else {
        el.setAttribute('stroke', 'rgba(255,255,255,0.2)')
        el.setAttribute('stroke-width', '1')
      }

      this.svg.appendChild(el)
    }
  }

  destroy(): void {
    this.svg?.remove()
    this.preview?.remove()
    this.svg = null
    this.preview = null
    this.previewLine = null
    this.previewLabel = null
    super.destroy()
  }
}
