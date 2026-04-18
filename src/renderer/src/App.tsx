import { Button } from '@renderer/components/ui/button'

function App(): React.JSX.Element {
  return (
    <div className="dark flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight">porcelain</h1>
      <p className="text-sm text-muted-foreground">viewer · git · agent companion</p>
      <Button variant="outline">Open repository</Button>
    </div>
  )
}

export default App
