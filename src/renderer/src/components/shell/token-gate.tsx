import logo from '@renderer/assets/logo.png'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { useTokenGate } from '@renderer/hooks/use-token-gate'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

/**
 * The browser client's lock screen. Porcelain's renderer ships as both the
 * Electron window (token from the preload bridge) and a plain browser client the
 * daemon serves — the browser has no bridge, so the human enters the daemon token
 * once here; it's persisted (localStorage) and the WS reconnects with it. In the
 * packaged app the gate is a no-op (status starts 'open'), so children render
 * directly. Renders BEFORE the app so nothing queries the daemon un-gated.
 */
export function TokenGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { status, connecting, error, connect } = useTokenGate()
  const [token, setToken] = useState('')

  // While the initial probe runs, hold on the same blank surface AppShell shows
  // during restore — no flash of the form before we know we even need it.
  if (status === 'checking') {
    return <div className="dark h-screen bg-background" />
  }

  if (status === 'open') return <>{children}</>

  return (
    <div className="dark flex h-screen flex-col items-center justify-center gap-8 bg-background px-6 text-foreground">
      <div className="flex flex-col items-center text-center">
        <img
          src={logo}
          alt=""
          draggable={false}
          className="size-20 [filter:drop-shadow(0_14px_30px_rgb(0_0_0/0.5))]"
        />
        <h1 className="mt-4 text-3xl font-medium tracking-tight">porcelain</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter your daemon token to connect</p>
      </div>
      <form
        className="flex w-80 flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (token.trim() !== '') connect(token.trim())
        }}
      >
        <Input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Daemon token"
          aria-label="Daemon token"
          autoFocus
          aria-invalid={error}
        />
        {error && (
          <p className="text-xs text-muted-foreground">
            That token was rejected. Check the token and try again.
          </p>
        )}
        <Button type="submit" disabled={connecting || token.trim() === ''}>
          {connecting && <Loader2 className="animate-spin" />}
          {connecting ? 'Connecting…' : 'Connect'}
        </Button>
      </form>
    </div>
  )
}
