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

/**
 * Three sections share a 390pt phone, so "Environments" gets ~85pt. `SegmentedControl`
 * already gives every segment `flex-1` and one line of `text-xs`, which is the geometry
 * the hand-tuned `TabsTrigger` was reaching for.
 */
const SECTIONS: { value: SettingsSection; label: string; testID: string }[] = [
  { value: 'general', label: 'General', testID: 'porcelain-settings-section-general' },
  { value: 'data', label: 'Data', testID: 'porcelain-settings-section-data' },
  {
    value: 'environments',
    label: 'Environments',
    testID: 'porcelain-settings-section-environments',
  },
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
      <PhoneHeader border={false} companion={false} title="Settings" workspace={false}>
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
        {section === 'data' ? <DataSettings /> : null}
        {section === 'environments' ? <EnvironmentsSettings /> : null}
      </SurfaceScroll>
    </View>
  )
}

// Re-export panels for the tablet settings sheet.
export { DataSettings, EnvironmentsSettings, GeneralSettings }
