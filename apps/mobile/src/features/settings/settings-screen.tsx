import { ScrollView, View } from 'react-native'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Text as UiText } from '@/components/ui/text'

import { PhoneHeader } from '../shell/phone-header'
import { type SettingsSection, useShellStore } from '../shell/shell-store'
import { EnvironmentsSettings } from './environments-panel'
import { GeneralSettings } from './general-panel'
import { ReviewSettings } from './review-panel'

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'review', label: 'Review' },
  { id: 'environments', label: 'Environments' },
]

/**
 * Phone Settings tab — full-screen (not a sheet). Section tabs live in the
 * header band so one divider sits under the chrome, not a double line.
 */
export function SettingsScreen(): React.JSX.Element {
  const section = useShellStore((state) => state.settingsSection)
  const setSettingsSection = useShellStore((state) => state.setSettingsSection)

  return (
    <View className="flex-1 bg-background" testID="porcelain-phone-settings">
      <Tabs
        className="min-h-0 flex-1 gap-0"
        value={section}
        onValueChange={(value) => {
          setSettingsSection(value as SettingsSection)
        }}
      >
        <PhoneHeader border={false} companion={false} title="Settings" workspace={false}>
          <View className="border-b border-border pb-3 pt-3">
            <TabsList className="h-10 w-full" testID="porcelain-settings-tabs">
              {SECTIONS.map((entry) => (
                <TabsTrigger
                  key={entry.id}
                  className="min-h-9 flex-1"
                  testID={`porcelain-settings-section-${entry.id}`}
                  value={entry.id}
                >
                  <UiText className="text-sm font-medium">{entry.label}</UiText>
                </TabsTrigger>
              ))}
            </TabsList>
          </View>
        </PhoneHeader>

        {SECTIONS.map((entry) => (
          <TabsContent key={entry.id} className="min-h-0 flex-1" value={entry.id}>
            <ScrollView
              className="flex-1"
              contentContainerClassName="gap-3 px-4 py-4 pb-10"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {entry.id === 'general' ? <GeneralSettings /> : null}
              {entry.id === 'review' ? <ReviewSettings /> : null}
              {entry.id === 'environments' ? <EnvironmentsSettings /> : null}
            </ScrollView>
          </TabsContent>
        ))}
      </Tabs>
    </View>
  )
}

// Re-export panels for the tablet settings sheet.
export { EnvironmentsSettings, GeneralSettings, ReviewSettings }
