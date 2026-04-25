import { AppShell } from '@renderer/components/shell/app-shell'
import { ApiProvider } from '@renderer/lib/query'

function App(): React.JSX.Element {
  return (
    <ApiProvider>
      <AppShell />
    </ApiProvider>
  )
}

export default App
