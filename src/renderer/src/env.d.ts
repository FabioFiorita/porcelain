/// <reference types="vite/client" />
/// <reference types="@testing-library/jest-dom/vitest" />

// The renderer's type graph now transitively reaches main/window.ts (api.ts imports
// it for windowInit/newWindow), which uses electron-vite's `?asset` import. That
// suffix is declared by `electron-vite/node` node-side; mirror it here so the web
// tsconfig can resolve it too.
declare module '*.png?asset' {
  const src: string
  export default src
}
