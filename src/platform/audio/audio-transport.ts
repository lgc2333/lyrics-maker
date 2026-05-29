import zhCN from '../../i18n/locales/zh-CN.json'

export interface AudioTransport {
  loadFile: (file: File) => Promise<void>
  play: () => Promise<void>
  pause: () => void
  seek: (time: number) => void
  getCurrentTime: () => number
  getDuration: () => number
  setVolume: (value: number) => void
  getVolume: () => number
  setPlaybackRate: (rate: number) => void
  getPlaybackRate: () => number
  getIsPlaying: () => boolean
  destroy: () => void
}

export function createAudioTransport(audioElement: HTMLAudioElement): AudioTransport {
  let objectUrl: string | null = null
  let _pendingCleanup: (() => void) | null = null

  return {
    async loadFile(file: File): Promise<void> {
      // Clean up any previous pending load before starting a new one
      if (_pendingCleanup) {
        _pendingCleanup()
        _pendingCleanup = null
      }

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
      objectUrl = URL.createObjectURL(file)

      return new Promise<void>((resolve, reject) => {
        const removeListeners = () => {
          audioElement.removeEventListener('loadedmetadata', handleLoaded)
          audioElement.removeEventListener('error', handleError)
          _pendingCleanup = null
        }
        function handleError() {
          removeListeners()
          reject(new Error(zhCN.errors.failedToLoadAudio))
        }
        function handleLoaded() {
          removeListeners()
          resolve()
        }
        _pendingCleanup = removeListeners
        audioElement.addEventListener('loadedmetadata', handleLoaded)
        audioElement.addEventListener('error', handleError)
        audioElement.src = objectUrl!
      })
    },

    async play(): Promise<void> {
      await audioElement.play()
    },

    pause(): void {
      audioElement.pause()
    },

    seek(time: number): void {
      audioElement.currentTime = Math.max(0, time)
    },

    getCurrentTime(): number {
      return audioElement.currentTime
    },

    getDuration(): number {
      return Number.isFinite(audioElement.duration) ? audioElement.duration : 0
    },

    setVolume(value: number): void {
      audioElement.volume = Math.max(0, Math.min(1, value))
    },

    getVolume(): number {
      return audioElement.volume
    },

    setPlaybackRate(rate: number): void {
      if (!(rate > 0)) {
        throw new Error(`playbackRate must be > 0 (received ${rate})`)
      }
      audioElement.playbackRate = rate
    },

    getPlaybackRate(): number {
      return audioElement.playbackRate
    },

    getIsPlaying(): boolean {
      // Use the DOM element's paused property directly.
      // The 'pause' event can be queued as a task and cancelled when
      // src is immediately changed (e.g. replacing audio during playback),
      // so the event-based `playing` flag can become permanently stale.
      return !audioElement.paused
    },

    destroy(): void {
      _pendingCleanup?.()
      if (audioElement.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioElement.src)
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
        objectUrl = null
      }
    },
  }
}
