import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'

/**
 * The frameless-chrome window controls (Linux/Windows) — min/maximize/close, all
 * shell-only. `isMaximized` stays fresh via the `maximized-changed` shell event
 * (use-app-events invalidates this query), so the maximize/restore glyph tracks
 * OS-driven state changes, not just our own toggle. macOS keeps its native traffic
 * lights and never mounts this.
 */
export function useWindowControls(): {
  isMaximized: boolean
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
} {
  const { data: isMaximized } = shellTrpc.windowIsMaximized.useQuery(undefined, {
    enabled: !isBrowser,
  })
  const minimize = shellTrpc.windowMinimize.useMutation()
  const toggleMaximize = shellTrpc.windowToggleMaximize.useMutation()
  const close = shellTrpc.windowClose.useMutation()

  return {
    isMaximized: isMaximized ?? false,
    minimize: () => minimize.mutate(),
    toggleMaximize: () => toggleMaximize.mutate(),
    close: () => close.mutate(),
  }
}
