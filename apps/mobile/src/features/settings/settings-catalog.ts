/**
 * The Settings sections this client offers, named once for the phone stack and the tablet
 * dialog.
 *
 * Share is host administration and stays off this client. Remotes stay — a phone pairs
 * daemons, it does not administer them.
 */
export type SettingsSection = 'general' | 'remotes' | 'updates'

export type SettingsScope = 'app' | 'environment'

export type SettingsSectionDef = {
  readonly id: SettingsSection
  readonly label: string
  readonly title: string
  readonly blurb: string
  readonly scope: SettingsScope
  readonly testID: string
}

const GENERAL_SECTION: SettingsSectionDef = {
  id: 'general',
  label: 'General',
  title: 'General',
  scope: 'app',
  blurb: 'How this app looks and reads. Saved on this device, for every Environment.',
  testID: 'porcelain-settings-section-general',
}

export const SETTINGS_SECTIONS: readonly SettingsSectionDef[] = [
  GENERAL_SECTION,
  {
    id: 'remotes',
    label: 'Remotes',
    title: 'Remotes',
    scope: 'environment',
    blurb:
      'Pair this device with a daemon. Prefer LAN first; add Tailscale or Cloudflare as fallbacks.',
    testID: 'porcelain-settings-section-remotes',
  },
  {
    id: 'updates',
    label: 'Updates',
    title: 'Updates',
    scope: 'app',
    blurb: 'The daemon this device is paired with. Check npm and restart to install.',
    testID: 'porcelain-settings-section-updates',
  },
]

export const SETTINGS_SCOPE_ORDER: readonly SettingsScope[] = ['app', 'environment']

export const SETTINGS_SCOPE_LABEL: Record<SettingsScope, string> = {
  app: 'This app',
  environment: 'Environments',
}

export function settingsSectionById(id: SettingsSection): SettingsSectionDef {
  const found = SETTINGS_SECTIONS.find((section) => section.id === id)
  return found ?? GENERAL_SECTION
}
