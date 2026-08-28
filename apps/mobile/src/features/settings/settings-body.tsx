import { EnvironmentsSettings } from './environments-panel'
import { GeneralSettings } from './general-panel'
import type { SettingsSection } from './settings-catalog'
import { UpdatesSettings } from './updates-panel'

/** The body of one Settings section, shared by the phone stack and the tablet dialog. */
export function SettingsSectionBody({ section }: { section: SettingsSection }): React.JSX.Element {
  switch (section) {
    case 'general':
      return <GeneralSettings />
    case 'remotes':
      return <EnvironmentsSettings />
    case 'updates':
      return <UpdatesSettings />
  }
}
