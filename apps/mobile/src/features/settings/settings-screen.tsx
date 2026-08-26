import { View } from 'react-native'

import { ScreenHeader } from '@/components/panel-chrome'
import { SurfaceScroll } from '@/components/surface-scroll'
import { Select } from '@/components/ui/select'

import { type SettingsSection, useShellStore } from '../shell/shell-store'
import { DataSettings } from './data-panel'
import { EnvironmentsSettings } from './environments-panel'
import { GeneralSettings } from './general-panel'
import { PersonalizationSettings } from './personalization-panel'

/**
 * The same four sections the desktop Settings dialog has, in its order: General ·
 * Personalization · Companion · Remotes. Share and Updates are shell concerns and are not
 * offered here.
 *
 * `Companion` is what this client used to call `Data` — it edits the repo companion channel
 * dispositions, which is companion state, not a fourth kind of preference. `Remotes` is what it
 * called `Environments`; the paired-daemon list is the same thing under the desktop's name.
 */
const SECTIONS: { value: SettingsSection; label: string; detail: string; testID: string }[] = [
  {
    value: 'general',
    label: 'General',
    detail: 'Viewer preferences, saved on this machine.',
    testID: 'porcelain-settings-section-general',
  },
  {
    value: 'personalization',
    label: 'Personalization',
    detail: 'Copyable guidance for how changes should read.',
    testID: 'porcelain-settings-section-personalization',
  },
  {
    value: 'companion',
    label: 'Companion',
    detail: 'The companion skill for your agents.',
    testID: 'porcelain-settings-section-companion',
  },
  {
    value: 'remotes',
    label: 'Remotes',
    detail: 'Connect this app to other daemons.',
    testID: 'porcelain-settings-section-remotes',
  },
]

/**
 * Phone Settings tab — full-screen (not a sheet).
 *
 * The section switcher is the first row of the content rather than part of the header band. It
 * used to hang off the bottom of a hand-rolled header and take the divider with it, so the two
 * read as one 90pt slab; `ScreenHeader` is a 48pt band with a hairline, the same as the web
 * client's, and the switcher scrolls under it like any other content.
 *
 * A `Select`, not the `SegmentedControl` the scope switchers use. Four segments across a phone
 * cannot print four words — "Personalization" and "Companion" were both losing their tails —
 * and the sections are a LIST rather than a scope: the desktop draws them as one, complete with
 * the sentence under each name, and the Environments picker this screen is going to grow has as
 * many entries as the human has machines. A control that divides the width by its option count
 * is the wrong shape for both.
 */
export function SettingsScreen(): React.JSX.Element {
  const section = useShellStore((state) => state.settingsSection)
  const setSettingsSection = useShellStore((state) => state.setSettingsSection)

  return (
    <View className="flex-1 bg-background" testID="porcelain-phone-settings">
      <ScreenHeader testID="porcelain-settings-header" title="Settings" />
      <SurfaceScroll
        gap={12}
        keyboardShouldPersistTaps="handled"
        paddingTop={12}
        showsVerticalScrollIndicator={false}
      >
        <Select<SettingsSection>
          options={SECTIONS}
          testID="porcelain-settings-tabs"
          title="Settings"
          value={section}
          onChange={setSettingsSection}
        />
        {section === 'general' ? <GeneralSettings /> : null}
        {section === 'personalization' ? <PersonalizationSettings /> : null}
        {section === 'companion' ? <DataSettings /> : null}
        {section === 'remotes' ? <EnvironmentsSettings /> : null}
      </SurfaceScroll>
    </View>
  )
}

export { DataSettings, EnvironmentsSettings, GeneralSettings, PersonalizationSettings }
