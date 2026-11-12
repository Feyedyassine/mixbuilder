/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '@fontsource-variable/chivo'
declare module '@fontsource-variable/chivo-mono'
