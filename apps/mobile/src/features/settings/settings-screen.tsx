import { useRouter } from 'expo-router'
import { View } from 'react-native'

import { ScreenHeader } from '@/components/panel-chrome'
import { SurfaceScroll } from '@/components/surface-scroll'
import { Select } from '@/components/ui/select'
import { useShellStore } from '@/features/shell/shell-store'

import { SettingsSectionBody } from './settings-body'
import { SETTINGS_SECTIONS, type SettingsSection } from './settings-catalog'

/**
 * Phone Settings — a full-screen stack with a back button.
 *
 * Tablet Settings is a dialog (`settings-dialog.tsx`). The section list is the same four:
 * General, Personalization, Companion, and Remotes, plus any host status section supported by
 * the current daemon. Project-specific Personalization also opens from its Project row.
 */
export function SettingsScreen(): React.JSX.Element {
  const router = useRouter()
  const section = useShellStore((state) => state.settingsSection)
  const setSettingsSection = useShellStore((state) => state.setSettingsSection)

  return (
    <View className="flex-1 bg-background" testID="porcelain-phone-settings">
      <ScreenHeader
        back={{
          accessibilityLabel: 'Worktrees',
          testID: 'porcelain-settings-back',
          onPress: () => {
            router.navigate('/')
          },
        }}
        testID="porcelain-settings-header"
        title="Settings"
      />
      <SurfaceScroll
        gap={12}
        keyboardShouldPersistTaps="handled"
        paddingTop={12}
        showsVerticalScrollIndicator={false}
      >
        <Select<SettingsSection>
          options={SETTINGS_SECTIONS.map((entry) => ({
            detail: entry.blurb,
            label: entry.label,
            testID: entry.testID,
            value: entry.id,
          }))}
          testID="porcelain-settings-tabs"
          title="Settings"
          value={section}
          onChange={setSettingsSection}
        />
        <SettingsSectionBody section={section} />
      </SurfaceScroll>
    </View>
  )
}

export { DataSettings } from './data-panel'
export { EnvironmentsSettings } from './environments-panel'
export { GeneralSettings } from './general-panel'
