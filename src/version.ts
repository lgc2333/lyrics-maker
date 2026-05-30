declare const __APP_VERSION__: string
declare const __APP_COMMIT__: string
declare const __APP_BRANCH__: string

export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__.length > 0
    ? __APP_VERSION__
    : 'dev'

export const APP_COMMIT: string =
  typeof __APP_COMMIT__ === 'string' && __APP_COMMIT__.length > 0
    ? __APP_COMMIT__
    : 'dev'

export const APP_BRANCH: string =
  typeof __APP_BRANCH__ === 'string' && __APP_BRANCH__.length > 0
    ? __APP_BRANCH__
    : 'dev'
