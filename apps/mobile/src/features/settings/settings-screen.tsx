import { View } from 'react-native'

import { SURFACE_GUTTER } from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Text as UiText } from '@/components/ui/text'
import { cn } from '@/lib/utils'

import { PhoneHeader } from '../shell/phone-header'
import { type SettingsSection, useShellStore } from '../shell/shell-store'
import { DataSettings } from './data-panel'
import { EnvironmentsSettings } from './environments-panel'
import { GeneralSettings } from './general-panel'
import { ReviewSettings } from './review-panel'

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'data', label: 'Data' },
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
          {/* The header hands its divider to this band so the tabs read as part of the chrome;
              the band therefore owns the gutter and the space above the line. */}
          <View className={cn(SURFACE_GUTTER, 'border-b border-border pb-3')}>
            <TabsList className="h-10 w-full" testID="porcelain-settings-tabs">
              {SECTIONS.map((entry) => (
                <TabsTrigger
                  key={entry.id}
                  className="min-h-9 min-w-0 flex-1 px-1.5"
                  testID={`porcelain-settings-section-${entry.id}`}
                  value={entry.id}
                >
                  {/* Four sections share a 390pt phone, so "Environments" has
                      ~85pt: one line, smaller type, and no wrap. */}
                  <UiText className="text-xs font-medium" numberOfLines={1}>
                    {entry.label}
                  </UiText>
                </TabsTrigger>
              ))}
            </TabsList>
          </View>
        </PhoneHeader>

        {SECTIONS.map((entry) => (
          <TabsContent key={entry.id} className="min-h-0 flex-1" value={entry.id}>
            <SurfaceScroll
              gap={12}
              keyboardShouldPersistTaps="handled"
              paddingTop={12}
              showsVerticalScrollIndicator={false}
            >
              {entry.id === 'general' ? <GeneralSettings /> : null}
              {entry.id === 'data' ? <DataSettings /> : null}
              {entry.id === 'review' ? <ReviewSettings /> : null}
              {entry.id === 'environments' ? <EnvironmentsSettings /> : null}
            </SurfaceScroll>
          </TabsContent>
        ))}
      </Tabs>
    </View>
  )
}

// Re-export panels for the tablet settings sheet.
export { DataSettings, EnvironmentsSettings, GeneralSettings, ReviewSettings }
