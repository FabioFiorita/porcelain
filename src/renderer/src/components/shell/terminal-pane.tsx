import '@xterm/xterm/css/xterm.css'

import { trpcClient } from '@renderer/lib/trpc'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useTerminalStore } from '@renderer/stores/terminal'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { ChevronUp, SquareTerminal } from 'lucide-react'
import { useEffect, useRef } from 'react'

const TERMINAL_THEME = {
  background: '#00000000',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
}

async function ensureSession(cwd: string): Promise<string> {
  const { termId, setTermId } = useTerminalStore.getState()
  if (termId && (await trpcClient.termExists.query(termId))) return termId
  const { id } = await trpcClient.termCreate.mutate({ cwd })
  setTermId(id)
  return id
}

export function TerminalPane(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!repo || !container) return

    const terminal = new Terminal({
      fontFamily:
        "'MesloLGS NF', 'JetBrainsMono Nerd Font', 'Hack Nerd Font', 'FiraCode Nerd Font', 'Symbols Nerd Font', Menlo, monospace",
      fontSize: 12,
      allowTransparency: true,
      theme: TERMINAL_THEME,
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(container)
    fit.fit()

    let disposed = false
    let unsubscribe: (() => void) | null = null

    const connect = async (): Promise<void> => {
      const id = await ensureSession(repo.path)
      if (disposed) return

      terminal.write(await trpcClient.termScrollback.query(id))
      const subscription = trpcClient.termOnData.subscribe(id, {
        onData: (data) => terminal.write(data),
      })
      const inputDisposable = terminal.onData((data) => {
        trpcClient.termWrite.mutate({ id, data })
      })
      const resizeObserver = new ResizeObserver(() => {
        fit.fit()
        trpcClient.termResize.mutate({ id, cols: terminal.cols, rows: terminal.rows })
      })
      resizeObserver.observe(container)
      trpcClient.termResize.mutate({ id, cols: terminal.cols, rows: terminal.rows })

      unsubscribe = () => {
        subscription.unsubscribe()
        inputDisposable.dispose()
        resizeObserver.disconnect()
      }
    }
    connect()

    return () => {
      disposed = true
      unsubscribe?.()
      terminal.dispose()
    }
  }, [repo])

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <TerminalHeader />
      <div ref={containerRef} className="min-h-0 flex-1 px-2 py-1" />
    </div>
  )
}

export function TerminalHeader(): React.JSX.Element {
  const terminalOpen = usePreferencesStore((s) => s.terminalOpen)
  const toggleTerminal = usePreferencesStore((s) => s.toggleTerminal)

  return (
    <button
      type="button"
      onClick={toggleTerminal}
      className="flex h-8 w-full shrink-0 items-center gap-2 border-b bg-sidebar px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
      aria-expanded={terminalOpen}
    >
      <SquareTerminal className="size-3.5" />
      Terminal
      <ChevronUp
        className={cn('ml-auto size-3.5 transition-transform', terminalOpen && 'rotate-180')}
      />
    </button>
  )
}
