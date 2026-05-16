export interface WritableFileLike {
  write: (content: string) => Promise<void>
  close: () => Promise<void>
}

export interface SaveFileHandleLike {
  createWritable: () => Promise<WritableFileLike>
}

export interface SaveFilePickerApi {
  showSaveFilePicker?: (options?: unknown) => Promise<SaveFileHandleLike>
}

export function hasSaveFilePicker(api: SaveFilePickerApi): api is SaveFilePickerApi & { showSaveFilePicker: NonNullable<SaveFilePickerApi['showSaveFilePicker']> } {
  return typeof api.showSaveFilePicker === 'function'
}
