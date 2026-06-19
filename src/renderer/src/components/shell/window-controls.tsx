import { Copy, Minus, Square, X } from 'lucide-react'
import { useEffect, useState } from 'react'

// Window controls for platforms without native traffic lights (Linux/Windows): a
// minimize / maximize-restore / close cluster wired straight to the preload bridge.
// App chrome — plain buttons + lucide icons over an IPC bridge, like the title bar's
// search button — not a shadcn primitive. Talks only to window.porcelain, never trpc.
export function WindowControls(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.porcelain.windowControls.isMaximized().then(setIsMaximized)
    return window.porcelain.windowControls.onMaximizedChange(setIsMaximized)
  }, [])

  const minimize = (): void => window.porcelain.windowControls.minimize()
  const toggleMaximize = (): void => window.porcelain.windowControls.toggleMaximize()
  const close = (): void => window.porcelain.windowControls.close()

  const button =
    'flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-(--hover-fill) hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

  return (
    <div className="app-no-drag flex items-center gap-0.5">
      <button type="button" onClick={minimize} aria-label="Minimize" className={button}>
        <Minus className="size-3.5" />
      </button>
      <button type="button" onClick={toggleMaximize} aria-label="Maximize" className={button}>
        {isMaximized ? <Copy className="size-3.5" /> : <Square className="size-3.5" />}
      </button>
      <button type="button" onClick={close} aria-label="Close" className={button}>
        <X className="size-3.5" />
      </button>
    </div>
  )
}
