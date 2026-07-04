import { useCursorPluginInfo, usePluginInfo } from '@renderer/hooks/use-plugin'
import { isBrowser } from '@renderer/lib/platform'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

const TOAST_ID = 'plugin-update'

/**
 * Watches for a newer bundled plugin version than the one the user last installed
 * and raises a single persistent toast pointing them at Settings → Agents, where
 * the existing CTA runs the update. The plugin section derives the same
 * `needsUpdate`, but only shows it once the dialog is open — this surfaces it
 * proactively on launch. Renders nothing.
 */
export function PluginUpdateToast(): null {
  const claudeInfo = usePluginInfo()
  const cursorInfo = useCursorPluginInfo()
  const pluginInstalled = usePreferencesStore((s) => s.pluginInstalled)
  const pluginVersion = usePreferencesStore((s) => s.pluginVersion)
  const cursorPluginInstalled = usePreferencesStore((s) => s.cursorPluginInstalled)
  const cursorPluginVersion = usePreferencesStore((s) => s.cursorPluginVersion)
  const dismissedVersion = usePreferencesStore((s) => s.pluginUpdateDismissedVersion)
  const cursorDismissedVersion = usePreferencesStore((s) => s.cursorPluginUpdateDismissedVersion)
  const setDismissedVersion = usePreferencesStore((s) => s.setPluginUpdateDismissedVersion)
  const setCursorDismissedVersion = usePreferencesStore(
    (s) => s.setCursorPluginUpdateDismissedVersion,
  )
  const shown = useRef<string | null>(null)

  const current = claudeInfo?.version ?? cursorInfo?.version
  const claudeNeedsUpdate = pluginInstalled && current !== undefined && pluginVersion !== current
  const cursorNeedsUpdate =
    cursorPluginInstalled && current !== undefined && cursorPluginVersion !== current
  const claudePending = claudeNeedsUpdate && dismissedVersion !== current
  const cursorPending = cursorNeedsUpdate && cursorDismissedVersion !== current
  const needsUpdate = claudePending || cursorPending

  useEffect(() => {
    // Plugin installs are shell-only; the browser client has nothing to update.
    if (isBrowser) return
    if (!needsUpdate || current === undefined) return
    if (shown.current === current) return
    shown.current = current

    const reloadHint =
      claudePending && cursorPending
        ? 'reload plugins in each agent'
        : claudePending
          ? 'run /reload-plugins in Claude Code'
          : 'run Developer: Reload Window in Cursor'

    toast.info('Plugin update available', {
      id: TOAST_ID,
      description: `Update to v${current}, then ${reloadHint}.`,
      duration: Number.POSITIVE_INFINITY,
      closeButton: true,
      action: {
        label: 'Open settings',
        onClick: () => {
          if (claudePending) setDismissedVersion(current)
          if (cursorPending) setCursorDismissedVersion(current)
          useSettingsDialogStore.getState().openTo('agents')
        },
      },
      onDismiss: () => {
        if (claudePending) setDismissedVersion(current)
        if (cursorPending) setCursorDismissedVersion(current)
      },
    })
  }, [
    needsUpdate,
    current,
    claudePending,
    cursorPending,
    setDismissedVersion,
    setCursorDismissedVersion,
  ])

  return null
}
