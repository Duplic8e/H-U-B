/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/preact" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Set only by the Hub build: the Hub home page this copy of Torque lives under. */
  readonly VITE_HUB_URL?: string;
}
