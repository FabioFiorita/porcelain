import { Button } from '@renderer/components/ui/button'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { compactButtonClass } from '@renderer/lib/controls'
import {
  copyTerminalSelection,
  getTerminalSelectionAnchor,
  subscribeTerminalSelection,
} from '@renderer/lib/terminal-registry'
import { cn } from '@renderer/lib/utils'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Floating Copy chip over a terminal selection — host-side copy of text the human
 * selected (the OSC 52 path is for apps that push the clipboard themselves).
 *
 * Pattern from T3 Code's terminal: select → popup with Copy. We only ship Copy
 * (no "Add to chat" — agents don't live in Porcelain). `mousedown` preventDefault
 * keeps Ghostty from clearing the selection before the click lands.
 */
export function TerminalSelectionToolbar({
  sessionId,
}: {
  sessionId: string
}): React.JSX.Element | null {
  const [anchor, setAnchor] = useState<{ left: number; top: number; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let disposed = false
    let unsub: (() => void) | null = null
    let raf = 0

    const refresh = (): void => {
      if (disposed) return
      setAnchor(getTerminalSelectionAnchor(sessionId))
      setCopied(false)
    }

    const connect = (): void => {
      if (disposed) return
      unsub = subscribeTerminalSelection(sessionId, refresh)
      if (!unsub) {
        // Parent attach effect hasn't created the Ghostty yet — try next frame.
        raf = requestAnimationFrame(connect)
        return
      }
      refresh()
    }
    connect()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      unsub?.()
    }
  }, [sessionId])

  if (!anchor) return null

  const handleCopy = async (): Promise<void> => {
    await copyTerminalSelection(sessionId)
    setCopied(true)
    setAnchor(null)
  }

  return (
    <div
      role="toolbar"
      aria-label="Selection"
      data-testid={TestIds.terminalSelectionToolbar}
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
    >
      <div className="pointer-events-auto absolute" style={{ left: anchor.left, top: anchor.top }}>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          data-testid={TestIds.terminalSelectionCopy}
          className={cn(
            compactButtonClass,
            'gap-1.5 border border-border bg-popover text-popover-foreground shadow-md',
            'hover:bg-accent hover:text-accent-foreground',
          )}
          // Don't let the press clear Ghostty's selection before onClick runs.
          onMouseDown={(e: React.MouseEvent<HTMLButtonElement>): void => e.preventDefault()}
          onClick={() => {
            runUserAction(
              async () => {
                await handleCopy()
              },
              (error) => {
                toastUserActionError('Copy selection', error)
              },
            )
          }}
        >
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          Copy
        </Button>
      </div>
    </div>
  )
}
