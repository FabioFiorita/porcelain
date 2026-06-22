import { usePluginInfo } from '@renderer/hooks/use-plugin'
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
  const info = usePluginInfo()
  const pluginInstalled = usePreferencesStore((s) => s.pluginInstalled)
  const pluginVersion = usePreferencesStore((s) => s.pluginVersion)
  const dismissedVersion = usePreferencesStore((s) => s.pluginUpdateDismissedVersion)
  const setDismissedVersion = usePreferencesStore((s) => s.setPluginUpdateDismissedVersion)
  // Guards against re-raising within a session (StrictMode double-invoke, query refetch).
  const shown = useRef<string | null>(null)

  const current = info?.version
  const needsUpdate = pluginInstalled && current !== undefined && pluginVersion !== current

  useEffect(() => {
    if (!needsUpdate || current === undefined) return
    if (shown.current === current || dismissedVersion === current) return
    shown.current = current

    toast.info('Plugin update available', {
      id: TOAST_ID,
      description: pluginVersion
        ? `You have v${pluginVersion}. Update to v${current}, then run /reload-plugins.`
        : `Update to v${current}, then run /reload-plugins.`,
      duration: Number.POSITIVE_INFINITY,
      closeButton: true,
      action: {
        label: 'Open settings',
        onClick: () => {
          setDismissedVersion(current)
          useSettingsDialogStore.getState().openTo('agents')
        },
      },
      onDismiss: () => setDismissedVersion(current),
    })
  }, [needsUpdate, current, pluginVersion, dismissedVersion, setDismissedVersion])

  return null
}
