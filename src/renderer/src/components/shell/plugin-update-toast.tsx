import { useCodexInfo } from '@renderer/hooks/use-codex'
import { usePluginInfo } from '@renderer/hooks/use-plugin'
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
  const codexInfo = useCodexInfo()
  const pluginInstalled = usePreferencesStore((s) => s.pluginInstalled)
  const pluginVersion = usePreferencesStore((s) => s.pluginVersion)
  const codexPluginInstalled = usePreferencesStore((s) => s.codexPluginInstalled)
  const codexPluginVersion = usePreferencesStore((s) => s.codexPluginVersion)
  const dismissedVersion = usePreferencesStore((s) => s.pluginUpdateDismissedVersion)
  const codexDismissedVersion = usePreferencesStore((s) => s.codexPluginUpdateDismissedVersion)
  const setDismissedVersion = usePreferencesStore((s) => s.setPluginUpdateDismissedVersion)
  const setCodexDismissedVersion = usePreferencesStore(
    (s) => s.setCodexPluginUpdateDismissedVersion,
  )
  const shown = useRef<string | null>(null)

  const current = claudeInfo?.version ?? codexInfo?.version
  const claudeNeedsUpdate = pluginInstalled && current !== undefined && pluginVersion !== current
  const codexNeedsUpdate =
    codexPluginInstalled && current !== undefined && codexPluginVersion !== current
  const claudePending = claudeNeedsUpdate && dismissedVersion !== current
  const codexPending = codexNeedsUpdate && codexDismissedVersion !== current
  const needsUpdate = claudePending || codexPending

  useEffect(() => {
    // Plugin installs are shell-only; the browser client has nothing to update.
    if (isBrowser) return
    if (!needsUpdate || current === undefined) return
    if (shown.current === current) return
    shown.current = current

    const reloadHint =
      claudePending && codexPending
        ? 'reload plugins in each agent'
        : claudePending
          ? 'run /reload-plugins in Claude Code'
          : 'start a new Codex thread'

    toast.info('Plugin update available', {
      id: TOAST_ID,
      description: `Update to v${current}, then ${reloadHint}.`,
      duration: Number.POSITIVE_INFINITY,
      closeButton: true,
      action: {
        label: 'Open settings',
        onClick: () => {
          if (claudePending) setDismissedVersion(current)
          if (codexPending) setCodexDismissedVersion(current)
          useSettingsDialogStore.getState().openTo('agents')
        },
      },
      onDismiss: () => {
        if (claudePending) setDismissedVersion(current)
        if (codexPending) setCodexDismissedVersion(current)
      },
    })
  }, [
    needsUpdate,
    current,
    claudePending,
    codexPending,
    setDismissedVersion,
    setCodexDismissedVersion,
  ])

  return null
}
