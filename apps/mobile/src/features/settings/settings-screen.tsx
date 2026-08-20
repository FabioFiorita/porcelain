import { View } from 'react-native'

import { SegmentedControl } from '@/components/native/segmented-control'
import { SurfaceScroll } from '@/components/surface-scroll'

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
const SECTIONS: { value: SettingsSection; label: string; testID: string }[] = [
  { value: 'general', label: 'General', testID: 'porcelain-settings-section-general' },
  {
    value: 'personalization',
    label: 'Personal',
    testID: 'porcelain-settings-section-personalization',
  },
  { value: 'companion', label: 'Companion', testID: 'porcelain-settings-section-companion' },
  { value: 'remotes', label: 'Remotes', testID: 'porcelain-settings-section-remotes' },
]

/**
 * Phone Settings tab — full-screen (not a sheet).
 *
 * The section switcher used to hang off the bottom of the hand-rolled header and take the
 * header's divider with it, so the two read as one band. The bar is `UINavigationBar` now and
 * nothing can be hung off it, so the switcher became the first row of the content instead —
 * which is also what lets the large title collapse, since the scroll view has to be the
 * screen's first child for iOS to drive it.
 *
 * It is the same `SegmentedControl` Changes and Files use — a native segmented control.
 */
export function SettingsScreen(): React.JSX.Element {
  const section = useShellStore((state) => state.settingsSection)
  const setSettingsSection = useShellStore((state) => state.setSettingsSection)

  return (
    <View className="flex-1 bg-background" testID="porcelain-phone-settings">
      <SurfaceScroll
        gap={12}
        keyboardShouldPersistTaps="handled"
        largeTitle
        paddingTop={12}
        showsVerticalScrollIndicator={false}
      >
        <SegmentedControl<SettingsSection>
          options={SECTIONS}
          testID="porcelain-settings-tabs"
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
