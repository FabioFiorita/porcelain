// Not `index.d.ts`: TypeScript shadows a `foo.d.ts` that sits beside a `foo.ts`, treating it
// as that file's emitted declaration. Under that name these globals were invisible to every
// project, and the assignments in index.ts leaned on @ts-expect-error instead.
import type { ElectronAPI } from '@electron-toolkit/preload'
import type { PorcelainBridge } from './bridge'

declare global {
  interface Window {
    electron: ElectronAPI
    /**
     * Declared here as well as in the renderer's `lib/trpc.ts`. The preload is what *assigns*
     * this global, and its own project cannot see a declaration that lives in apps/web — so
     * without this row the assignment below needed an escape hatch that was simultaneously
     * unused everywhere the renderer declaration was in scope.
     */
    porcelain: PorcelainBridge
  }
}
