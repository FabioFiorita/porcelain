import { lazy, Suspense } from 'react'

/**
 * Dev-only devtools mount. `import.meta.env.DEV` is a build-time constant that
 * is `true` only under `electron-vite dev` (`pnpm dev`) and `false` in
 * `electron-vite build` (`pnpm start`, the packaged app, and the e2e build).
 * Because the dynamic import lives behind that static-`false` branch in prod,
 * Vite eliminates it entirely — the devtools shell and its (devDependency)
 * packages never enter the production bundle.
 */
const DevtoolsShell = import.meta.env.DEV
  ? lazy(() => import('./devtools-shell').then((m) => ({ default: m.DevtoolsShell })))
  : null

export function Devtools(): React.JSX.Element | null {
  if (!DevtoolsShell) return null
  return (
    <Suspense fallback={null}>
      <DevtoolsShell />
    </Suspense>
  )
}
