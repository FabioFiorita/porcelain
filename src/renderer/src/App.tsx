import { AppShell } from '@renderer/components/shell/app-shell'
import { ErrorBoundary } from '@renderer/components/shell/error-boundary'
import { Devtools } from '@renderer/lib/devtools'
import { ApiProvider } from '@renderer/lib/query'

function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <ApiProvider>
        <AppShell />
        <Devtools />
      </ApiProvider>
    </ErrorBoundary>
  )
}

export default App
