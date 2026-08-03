import { AppShell } from '@renderer/components/shell/app-shell'
import { ErrorBoundary } from '@renderer/components/shell/error-boundary'
import { TokenGate } from '@renderer/components/shell/token-gate'
import { Devtools } from '@renderer/lib/devtools'
import { ApiProvider } from '@renderer/lib/query'

function App(): React.JSX.Element {
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
