import { AppShell } from '@renderer/components/shell/app-shell'
import { ErrorBoundary } from '@renderer/components/shell/error-boundary'
import { ApiProvider } from '@renderer/lib/query'

function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <ApiProvider>
        <AppShell />
      </ApiProvider>
    </ErrorBoundary>
  )
}

export default App
