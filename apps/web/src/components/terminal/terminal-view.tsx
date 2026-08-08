import { TerminalContextMenu } from '@renderer/components/terminal/terminal-context-menu'
import { TerminalKeyBar } from '@renderer/components/terminal/terminal-key-bar'
import { TerminalSelectionToolbar } from '@renderer/components/terminal/terminal-selection-toolbar'
import { useResolvedTheme } from '@renderer/hooks/use-theme'
import { isCoarseTouch } from '@renderer/lib/platform'
import {
  attachTerminal,
  attachTerminalFiles,
  detachTerminal,
  fitTerminal,
  focusTerminal,
  TERMINAL_THEMES,
} from '@renderer/lib/terminal-registry'
import { useEffect, useRef } from 'react'

/** Squared px movement above this = pan (scroll), not a tap that should raise the keyboard. */
const TAP_SLOP_SQ = 10 * 10

/**
 * One terminal in the viewer. The Ghostty instance lives in the registry (it outlives
 * this mount), so all this does is re-parent it into the pane on mount, keep it sized
 * to the pane (ResizeObserver → fit → PTY resize), and detach — never dispose — on
 * unmount. Keyed by sessionId in the viewer switch, so each pane shows its own PTY.
 */
export function TerminalView({ sessionId }: { sessionId: string }): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const mode = useResolvedTheme()
  // Touch / software-keyboard devices only — always on, not a Settings preference.
  // Gate is `isCoarseTouch`, NOT width: iPad landscape is desktop-width and still needs
  // Esc/Tab/Ctrl the soft keyboard doesn't provide.
  const keyBar = isCoarseTouch()
  // Tap-vs-pan: pointerdown alone raises the iOS keyboard even when the finger was only
  // scrolling. Sample the start point and focus only if the gesture stayed within slop.
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

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

  // Column: key bar ABOVE the Ghostty host on touch. The soft keyboard covers the bottom of
  // the visual viewport, so a bottom bar was hidden whenever you were typing — the whole
  // reason the bar exists. Top keeps Esc/Ctrl/^C reachable above the keyboard.
  // The Ghostty host must be sized by flex (min-h-0 + flex-1), not the full pane, or the
  // ResizeObserver fits cols/rows to a height that includes the bar and the last line hides.
  // Selection Copy chip is absolute over the host (sibling of the Ghostty wrapper).
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {keyBar && <TerminalKeyBar sessionId={sessionId} />}
      {/* Host is `relative` so the selection Copy chip can sit over the Ghostty
          (chip coords are resolved against this box via the wrapper's parent). */}
      <TerminalContextMenu sessionId={sessionId}>
        <div
          ref={ref}
          aria-label="Terminal"
          // touch-none: Safari must not claim the pan for page rubber-band; the registry's
          // The Ghostty host owns vertical pan (see terminal-touch-scroll.ts + terminal CSS).
          className="relative min-h-0 h-full touch-none overflow-hidden py-2 pr-1 pl-2"
          role="application"
          style={{ backgroundColor: TERMINAL_THEMES[mode].background }}
          onPointerDown={(e: React.PointerEvent<HTMLDivElement>): void => {
            if (!isCoarseTouch()) {
              focusTerminal(sessionId)
              return
            }
            pointerStart.current = { x: e.clientX, y: e.clientY }
          }}
          onPointerUp={(e: React.PointerEvent<HTMLDivElement>): void => {
            if (!isCoarseTouch()) return
            const start = pointerStart.current
            pointerStart.current = null
            if (!start) return
            const dx = e.clientX - start.x
            const dy = e.clientY - start.y
            if (dx * dx + dy * dy <= TAP_SLOP_SQ) focusTerminal(sessionId)
          }}
          onPointerCancel={() => {
            pointerStart.current = null
          }}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes('Files')) event.preventDefault()
          }}
          onDrop={async (event) => {
            if (event.dataTransfer.files.length === 0) return
            event.preventDefault()
            await attachTerminalFiles(sessionId, Array.from(event.dataTransfer.files))
          }}
        >
          <TerminalSelectionToolbar sessionId={sessionId} />
        </div>
      </TerminalContextMenu>
    </div>
  )
}
