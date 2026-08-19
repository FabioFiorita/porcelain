import { AppShell } from '@renderer/components/shell/app-shell'
import { ErrorBoundary } from '@renderer/components/shell/error-boundary'
import { TokenGate } from '@renderer/components/shell/token-gate'
import { QuickAddView } from '@renderer/features/tasks'
import { Devtools } from '@renderer/lib/devtools'
import { isBrowser } from '@renderer/lib/platform'
import { ApiProvider } from '@renderer/lib/query'

/**
 * The one non-shell surface this bundle serves: the Electron menu-bar popover loads the
 * SAME renderer at `#/quick-add` instead of a second, hand-built form in the main process.
 * Shell-only — a browser tab on that hash still gets the app (there is no popover window
 * there to dismiss, and no menu-bar icon that could have opened it).
 */
function isQuickAddSurface(): boolean {
  return !isBrowser && window.location.hash === '#/quick-add'
}

function App(): React.JSX.Element {
  if (isQuickAddSurface()) {
    return (
      <ErrorBoundary>
        <ApiProvider>
          <QuickAddView />
        </ApiProvider>
      </ErrorBoundary>
    )
  }
  return (
    <ErrorBoundary>
      <ApiProvider>
        {/* In the browser client, the gate holds the app behind the daemon token
            (a no-op in the packaged app); AppShell's boot() only fires once it
            renders, so nothing queries the daemon before the token is accepted. */}
        <TokenGate>
          <AppShell />
        </TokenGate>
        <Devtools />
      </ApiProvider>
    </ErrorBoundary>
  )
}

export default App
