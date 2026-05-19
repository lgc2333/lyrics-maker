import zhCN from '../i18n/locales/zh-CN.json'

export interface AudioTransport {
  loadFile: (file: File) => Promise<void>
  play: () => Promise<void>
  pause: () => void
  seek: (time: number) => void
  getCurrentTime: () => number
  getDuration: () => number
  setVolume: (value: number) => void
  getVolume: () => number
  getIsPlaying: () => boolean
  destroy: () => void
}

export function createAudioTransport(audioElement: HTMLAudioElement): AudioTransport {
  let objectUrl: string | null = null
  let playing = false
  let _pendingCleanup: (() => void) | null = null

  const onPlay = () => {
    playing = true
  }
  const onPause = () => {
    playing = false
  }
  const onEnded = () => {
    playing = false
  }

  audioElement.addEventListener('play', onPlay)
  audioElement.addEventListener('pause', onPause)
  audioElement.addEventListener('ended', onEnded)

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
      audioElement.src = objectUrl

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

    getIsPlaying(): boolean {
      return playing
    },

    destroy(): void {
      audioElement.removeEventListener('play', onPlay)
      audioElement.removeEventListener('pause', onPause)
      audioElement.removeEventListener('ended', onEnded)
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
        objectUrl = null
      }
    },
  }
}
