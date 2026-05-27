import BasePlugin from 'wavesurfer.js/dist/base-plugin.js'
import type { BasePluginEvents } from 'wavesurfer.js/dist/base-plugin.js'

import { getOverlayStyleTokens } from './overlay-style-tokens'
import type { OverlayStyleContext } from './overlay-style-tokens'

export interface PlayheadOverlayOptions extends OverlayStyleContext {
  outerContainer?: HTMLElement
}

export interface PlayheadOverlayParams extends OverlayStyleContext {
  currentTime: number
}

export class PlayheadOverlayPlugin extends BasePlugin<
  BasePluginEvents,
  PlayheadOverlayOptions
> {
  private line: HTMLDivElement | null = null
  private markers: HTMLDivElement[] = []
  private currentTime = 0
  private styleContext: OverlayStyleContext = {}

  static create(options?: PlayheadOverlayOptions): PlayheadOverlayPlugin {
    return new PlayheadOverlayPlugin(options ?? {})
  }

  protected onInit(): void {
    const ws = this.wavesurfer!
    const wrapper = ws.getWrapper()
    const containerEl: HTMLElement =
      this.options.outerContainer ??
      (() => {
        const root = wrapper.getRootNode()
        const host = (root as ShadowRoot).host
        return (host as HTMLElement | undefined) ?? wrapper
      })()

    const tokens = this._tokens()
    this.line = document.createElement('div')
    this.line.dataset.testid = 'timeline-playhead'
    Object.assign(this.line.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '2px',
      height: '100%',
      background: tokens.color,
      boxShadow: tokens.shadow,
      pointerEvents: 'none',
      zIndex: '5',
      transform: 'translateX(-9999px)',
      willChange: 'transform',
    })
    this.line.append(
      this._createMarker('timeline-playhead-marker-top', 'top'),
      this._createMarker('timeline-playhead-marker-bottom', 'bottom'),
    )

    containerEl.style.position = 'relative'
    containerEl.appendChild(this.line)

    this.subscriptions.push(
      ws.on('scroll', () => this._position()),
      ws.on('zoom', () => this._position()),
      ws.on('ready', () => this._position()),
      ws.on('redraw', () => this._position()),
      ws.on('resize', () => this._position()),
    )
  }

  private _createMarker(testId: string, edge: 'top' | 'bottom'): HTMLDivElement {
    const tokens = this._tokens()
    const markerWidth = 11
    const markerHeight = 9
    const marker = document.createElement('div')
    marker.dataset.testid = testId
    Object.assign(marker.style, {
      position: 'absolute',
      left: '50%',
      width: `${markerWidth}px`,
      height: `${markerHeight}px`,
      transform: 'translateX(-50%)',
      background: tokens.color,
      clipPath:
        edge === 'top'
          ? 'polygon(0px 0px, 100% 0px, 50% 100%, 50% 100%)'
          : 'polygon(50% 0px, 100% 100%, 0px 100%)',
      pointerEvents: 'none',
      filter: tokens.markerShadow,
      ...(edge === 'top' ? { top: '0' } : { bottom: '0' }),
    })
    this.markers.push(marker)
    return marker
  }

  update(params: PlayheadOverlayParams): void {
    this.currentTime = params.currentTime
    this.styleContext = params
    this._applyTokens()
    this._position()
  }

  private _tokens() {
    return getOverlayStyleTokens({
      theme: this.styleContext.theme ?? this.options.theme,
      viewMode: this.styleContext.viewMode ?? this.options.viewMode,
    }).playhead
  }

  private _applyTokens(): void {
    if (!this.line) return
    const tokens = this._tokens()
    this.line.style.background = tokens.color
    this.line.style.boxShadow = tokens.shadow
    for (const marker of this.markers) {
      marker.style.background = tokens.color
      marker.style.filter = tokens.markerShadow
    }
  }

  private _position(): void {
    if (!this.line || !this.wavesurfer) return

    const duration = this.wavesurfer.getDuration()
    const wrapper = this.wavesurfer.getWrapper()
    const scrollContainer = wrapper.parentElement
    if (!scrollContainer || duration <= 0 || wrapper.scrollWidth <= 0) {
      this.line.style.display = 'none'
      return
    }

    const pxPerSec = wrapper.scrollWidth / duration
    const x = this.currentTime * pxPerSec - scrollContainer.scrollLeft
    const translateX = Math.round(x * 1000) / 1000
    const buffer = 4
    if (x < -buffer || x > scrollContainer.clientWidth + buffer) {
      this.line.style.display = 'none'
      this.line.style.transform = `translateX(${translateX}px)`
      return
    }

    this.line.style.display = 'block'
    this.line.style.transform = `translateX(${translateX}px)`
  }

  destroy(): void {
    this.line?.remove()
    this.line = null
    this.markers = []
    super.destroy()
  }
}
