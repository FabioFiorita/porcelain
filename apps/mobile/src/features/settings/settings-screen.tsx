import { View } from 'react-native'

import { SegmentedControl } from '@/components/segmented-control'
import { SURFACE_GUTTER } from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { cn } from '@/lib/utils'

import { PhoneHeader } from '../shell/phone-header'
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
 * Phone Settings tab — full-screen (not a sheet). The section switcher lives in the header
 * band so one divider sits under the chrome, not a double line.
 *
 * It is the same `SegmentedControl` Changes and Files use. Settings had the app's only
 * `ui/tabs` switcher, which meant one screen answering a tap with a different shape,
 * height, and selected fill than the other surfaces.
 */
export function SettingsScreen(): React.JSX.Element {
  const section = useShellStore((state) => state.settingsSection)
  const setSettingsSection = useShellStore((state) => state.setSettingsSection)

  return (
    <View className="flex-1 bg-background" testID="porcelain-phone-settings">
      <PhoneHeader back={false} border={false} companion={false} search={false} title="Settings">
        {/* The header hands its divider to this band so the switcher reads as part of the
            chrome; the band therefore owns the gutter and the space above the line. */}
        <View className={cn(SURFACE_GUTTER, 'border-b border-border pb-3')}>
          <SegmentedControl<SettingsSection>
            options={SECTIONS}
            testID="porcelain-settings-tabs"
            value={section}
            onChange={setSettingsSection}
          />
        </View>
      </PhoneHeader>

      <SurfaceScroll
        gap={12}
        keyboardShouldPersistTaps="handled"
        paddingTop={12}
        showsVerticalScrollIndicator={false}
      >
        {section === 'general' ? <GeneralSettings /> : null}
        {section === 'personalization' ? <PersonalizationSettings /> : null}
        {section === 'companion' ? <DataSettings /> : null}
        {section === 'remotes' ? <EnvironmentsSettings /> : null}
      </SurfaceScroll>
    </View>
  )
}

export { DataSettings, EnvironmentsSettings, GeneralSettings, PersonalizationSettings }
