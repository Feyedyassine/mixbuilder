/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_ID?: string
  readonly VITE_SHARE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '@fontsource-variable/chivo'
declare module '@fontsource-variable/chivo-mono'
