export function getPlatformSavePickerApi(): SaveFilePickerApi {
  return window as unknown as SaveFilePickerApi
}

export function getPlatformFilePickerApi(): ProjectFilePickerApi {
  return window as unknown as ProjectFilePickerApi
}

export interface WritableFileLike {
  write: (content: string) => Promise<void>
  close: () => Promise<void>
}

export interface SaveFileHandleLike {
  createWritable: () => Promise<WritableFileLike>
}

export interface OpenFileHandleLike extends SaveFileHandleLike {
  getFile: () => Promise<File>
}

export interface SaveFilePickerApi {
  showSaveFilePicker?: (options?: unknown) => Promise<SaveFileHandleLike>
}

export interface OpenFilePickerApi {
  showOpenFilePicker?: (options?: unknown) => Promise<OpenFileHandleLike[]>
}

export type ProjectFilePickerApi = SaveFilePickerApi & OpenFilePickerApi

export function hasSaveFilePicker(api: SaveFilePickerApi): api is SaveFilePickerApi & {
  showSaveFilePicker: NonNullable<SaveFilePickerApi['showSaveFilePicker']>
} {
  return typeof api.showSaveFilePicker === 'function'
}

export function hasOpenFilePicker(api: OpenFilePickerApi): api is OpenFilePickerApi & {
  showOpenFilePicker: NonNullable<OpenFilePickerApi['showOpenFilePicker']>
} {
  return typeof api.showOpenFilePicker === 'function'
}
