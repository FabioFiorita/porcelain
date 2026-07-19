import { useResolvedTheme } from '@renderer/hooks/use-theme'
import {
  attachTerminal,
  detachTerminal,
  fitTerminal,
  focusTerminal,
  TERMINAL_THEMES,
} from '@renderer/lib/terminal-registry'
import { useEffect, useRef } from 'react'

/**
 * One terminal in the viewer. The xterm instance lives in the registry (it outlives
 * this mount), so all this does is re-parent it into the pane on mount, keep it sized
 * to the pane (ResizeObserver → fit → PTY resize), and detach — never dispose — on
 * unmount. Keyed by sessionId in the viewer switch, so each pane shows its own PTY.
 */
export function TerminalView({ sessionId }: { sessionId: string }): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const mode = useResolvedTheme()

  useEffect(() => {
    const container = ref.current
    if (!container) return
    attachTerminal(sessionId, container)
    // Debounce the fit: a drag-resize fires ResizeObserver continuously, and every fit that
    // changes cols/rows sends a PTY resize (SIGWINCH). A storm of those makes shells like
    // p10k reprint their prompt per step, stacking copies up the scrollback — so we wait for
    // the size to settle and fit once. (The initial fit already happened in attachTerminal.)
    let pending: ReturnType<typeof setTimeout> | undefined
    const observer = new ResizeObserver(() => {
      if (pending !== undefined) clearTimeout(pending)
      pending = setTimeout(() => fitTerminal(sessionId), 100)
    })
    observer.observe(container)
    return () => {
      if (pending !== undefined) clearTimeout(pending)
      observer.disconnect()
      detachTerminal(sessionId, container)
    }
  }, [sessionId])

  return (
    <div
      ref={ref}
      className="h-full w-full overflow-hidden py-2 pr-1 pl-2"
      style={{ backgroundColor: TERMINAL_THEMES[mode].background }}
      onPointerDown={() => focusTerminal(sessionId)}
    />
  )
}
