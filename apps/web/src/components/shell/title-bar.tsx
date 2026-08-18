import { isLinuxShell } from '@renderer/lib/platform'
import { WindowControls } from './window-controls'

/**
 * Frameless-window chrome: Linux/Windows Electron has no native titlebar, so this row
 * supplies the drag region and the drawn min/maximize/close cluster. macOS keeps its
 * native traffic lights and needs no drawn row at all — the sidebar header sits at the
 * window's true top instead (see app-sidebar.tsx `isMacShell` padding). The browser
 * client never had native window chrome to begin with.
 *
 * The update chip used to live here; it moved into the sidebar header so browser
 * clients (which never rendered this row) get it too. The environment switcher that
 * lived beside it was retired outright — projects surface across every environment
 * in the Hub tree now, so there is nothing left to switch.
 */
export function TitleBar(): React.JSX.Element | null {
  if (!isLinuxShell) return null

  return (
    <div className="app-drag relative flex h-12 shrink-0 items-center justify-end px-3">
      <WindowControls />
    </div>
  )
}
