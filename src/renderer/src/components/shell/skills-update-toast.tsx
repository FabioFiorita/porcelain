import { useSkillsInfo } from '@renderer/hooks/use-skills'
import { isBrowser } from '@renderer/lib/platform'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

const TOAST_ID = 'skills-update'

/**
 * Watches for a newer bundled skills version than the one the user last dismissed
 * and raises a single persistent toast pointing them at Settings → Agents, where
 * the upgrade command is copyable. Renders nothing.
 */
export function SkillsUpdateToast(): null {
  const info = useSkillsInfo()
  const dismissedVersion = usePreferencesStore((s) => s.skillsDismissedVersion)
  const setDismissedVersion = usePreferencesStore((s) => s.setSkillsDismissedVersion)
  const shown = useRef<string | null>(null)

  const current = info?.version
  // Nag about a newer bundled skills version once, until the user dismisses it (we
  // remember the dismissed version). The old "any agent has Porcelain configured"
  // engaged-user gate is gone with the CLI move — the porcelain CLI now installs for
  // every user automatically, so there's no per-user setup signal to key off.
  const needsUpdate = current !== undefined && dismissedVersion !== current

  useEffect(() => {
    // Skills installs are shell-only; the browser client has nothing to update.
    if (isBrowser) return
    // Suppress under the e2e harness — deterministic e2e screenshots.
    if (window.porcelain?.e2e) return
    if (!needsUpdate || current === undefined) return
    if (shown.current === current) return
    shown.current = current

    toast.info('Skills update available', {
      id: TOAST_ID,
      description: `Porcelain skills v${current} are bundled. Run \`npx skills upgrade\` to update.`,
      duration: Number.POSITIVE_INFINITY,
      closeButton: true,
      action: {
        label: 'Open settings',
        onClick: () => {
          setDismissedVersion(current)
          useSettingsDialogStore.getState().openTo('agents')
        },
      },
      onDismiss: () => {
        setDismissedVersion(current)
      },
    })
  }, [needsUpdate, current, setDismissedVersion])

  return null
}
