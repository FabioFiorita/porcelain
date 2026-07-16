import { useAgentMcpInfo } from '@renderer/hooks/use-agent-mcp'
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
  const mcpInfo = useAgentMcpInfo()
  const dismissedVersion = usePreferencesStore((s) => s.skillsDismissedVersion)
  const setDismissedVersion = usePreferencesStore((s) => s.setSkillsDismissedVersion)
  // Disk probe: any agent with Porcelain MCP written is an engaged user. Client-
  // local prefs used to false-negative after a prefs clear or external MCP write.
  const anyMcpConfigured = mcpInfo?.agents.some((a) => a.configured) ?? false
  const shown = useRef<string | null>(null)

  const current = info?.version
  // Only nag about a newer skills bundle once the user has wired up at least one
  // agent's MCP — a strong signal they use the Porcelain integration (and have
  // likely run `npx skills add`). Skills.sh installs happen outside the app, so
  // this is our best "engaged user" proxy. Without it a brand-new user, who has
  // installed nothing, gets told "update available" on first launch (and the toast
  // bleeds into every screenshot). Mirrors the old plugin toast's `installed` gate.
  const needsUpdate = anyMcpConfigured && current !== undefined && dismissedVersion !== current

  useEffect(() => {
    // Skills installs are shell-only; the browser client has nothing to update.
    if (isBrowser) return
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
