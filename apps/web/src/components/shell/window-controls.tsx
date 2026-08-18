import { Button } from '@renderer/components/ui/button'
import { useWindowControls } from '@renderer/hooks/use-window-controls'
import { Copy, Minus, Square, X } from 'lucide-react'

/**
 * The custom min/maximize-restore/close cluster for the frameless shell (Linux and
 * Windows, where window.ts sets `frame: false`) — macOS keeps its native traffic
 * lights, so this mounts only when `isFramelessShell` (see title-bar.tsx). Keyed off
 * frameless rather than Linux because a Windows window is frameless too, and gating on
 * Linux left it with no way to close itself. The maximize glyph swaps to overlapping
 * squares (Copy) when the window is maximized, and the close button gets a
 * destructive hover so it reads as the one that ends the window.
 */
export function WindowControls(): React.JSX.Element {
  const { isMaximized, minimize, toggleMaximize, close } = useWindowControls()

  return (
    <div className="app-no-drag flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Minimize window"
        onClick={() => {
          minimize()
        }}
      >
        <Minus />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
        onClick={() => {
          toggleMaximize()
        }}
      >
        {isMaximized ? <Copy /> : <Square />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Close window"
        onClick={() => {
          close()
        }}
        className="hover:bg-destructive/20 hover:text-destructive dark:hover:bg-destructive/30"
      >
        <X />
      </Button>
    </div>
  )
}
