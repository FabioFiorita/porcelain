/// <reference types="vite/client" />
/// <reference types="@testing-library/jest-dom/vitest" />

declare const __PORCELAIN_VERSION__: string
declare const __PORCELAIN_PLUGIN_VERSION__: string

// The web type graph transitively reaches main/window.ts (shell-api.ts
// imports it for windowInit/newWindow), which uses electron-vite's `?asset` import.
// That suffix is declared by `electron-vite/node` node-side; mirror it here so the
// web tsconfig can resolve it too.
declare module '*.png?asset' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.css' {
  const css: string
  export default css
}
