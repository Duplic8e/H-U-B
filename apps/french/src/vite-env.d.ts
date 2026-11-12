/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Set by the Hub build: the Hub home page. */
  readonly VITE_HUB_URL?: string;
}
