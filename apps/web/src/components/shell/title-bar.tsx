import { isFramelessShell } from '@renderer/lib/platform'
import { WindowControls } from './window-controls'

/**
 * Frameless-window chrome: Linux and Windows Electron get `frame: false` (window.ts), so
 * this row supplies the drag region and the drawn min/maximize/close cluster. macOS keeps
 * its native traffic lights and needs no drawn row at all — whichever chrome sits at the
 * window's true top-left reserves space for them instead (`app-sidebar.tsx` when the left
 * sidebar is open, `viewer-header.tsx` when it is collapsed). The browser client never had
 * native window chrome to begin with.
 *
 * The update chip used to live here; it moved into the sidebar header, which is the one
 * top-level chrome every client renders — this row is now frameless-only, so leaving the
 * chip here would have hidden it from macOS. (The browser still renders no chip at all:
 * it has no auto-updater — see `update-button.tsx`.) The environment switcher that lived
 * beside it was retired outright — projects surface across every environment in the Hub
 * tree now, so there is nothing left to switch.
 */
export function TitleBar(): React.JSX.Element | null {
  if (!isFramelessShell) return null

  return (
    <div className="app-drag relative flex h-12 shrink-0 items-center justify-end px-3">
      <WindowControls />
    </div>
  )
}
