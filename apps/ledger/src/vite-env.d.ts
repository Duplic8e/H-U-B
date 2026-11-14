/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

declare const __APP_VERSION__: string

declare module '*.md?raw' {
  const src: string
  export default src
}

interface ImportMetaEnv {
  /** Set only by the Hub build: the Hub home page this copy of Ledger lives under. */
  readonly VITE_HUB_URL?: string
}
