import {
  attachTerminal,
  detachTerminal,
  fitTerminal,
  focusTerminal,
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

  useEffect(() => {
    const container = ref.current
    if (!container) return
    attachTerminal(sessionId, container)
    const observer = new ResizeObserver(() => fitTerminal(sessionId))
    observer.observe(container)
    return () => {
      observer.disconnect()
      detachTerminal(sessionId)
    }
  }, [sessionId])

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: clicking anywhere refocuses the PTY
    <div
      ref={ref}
      className="h-full w-full overflow-hidden bg-[#16161a] p-2"
      onMouseDown={() => focusTerminal(sessionId)}
    />
  )
}
