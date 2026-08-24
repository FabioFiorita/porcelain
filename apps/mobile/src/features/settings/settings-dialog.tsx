import * as DialogPrimitive from '@rn-primitives/dialog'
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native'

import { IconAction } from '@/components/panel-chrome'
import { Text } from '@/components/ui/text'
import { useShellStore } from '@/features/shell/shell-store'
import { cn } from '@/lib/utils'

import { SettingsSectionBody } from './settings-body'
import {
  SETTINGS_SCOPE_LABEL,
  SETTINGS_SCOPE_ORDER,
  SETTINGS_SECTIONS,
  settingsSectionById,
} from './settings-catalog'

const FILL = { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 } as const
const SCRIM = { ...FILL, backgroundColor: 'rgba(0, 0, 0, 0.5)' } as const

/**
 * Tablet Settings — the web/Mac dialog: a side nav of sections and a scrolling body.
 *
 * Phone Settings stays a full-screen stack with a back button. This overlay is the extra
 * width of a tablet, not a stretched phone sheet.
 */
export function SettingsDialog(): React.JSX.Element {
  const open = useShellStore((state) => state.settingsOpen)
  const closeSettings = useShellStore((state) => state.closeSettings)
  const sectionId = useShellStore((state) => state.settingsSection)
  const setSection = useShellStore((state) => state.setSettingsSection)
  const { height, width } = useWindowDimensions()
  const section = settingsSectionById(sectionId)
  const dialogWidth = Math.min(880, width - 48)
  const dialogHeight = Math.min(560, height - 48)

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) closeSettings()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay asChild>
          <Pressable
            className="items-center justify-center"
            /* nativewind-allow-style: see `SCRIM`. */
            style={SCRIM}
            testID="porcelain-settings-dialog-backdrop"
          >
            <DialogPrimitive.Content asChild>
              {/* panel-card-allow: this is the Settings window shell, not a content card. */}
              <View
                className="flex-row overflow-hidden rounded-xl border border-border bg-card"
                onStartShouldSetResponder={() => true}
                /* nativewind-allow-style: the card is a fraction of the window, not a token. */
                style={{ height: dialogHeight, width: dialogWidth }}
                testID="porcelain-settings-dialog"
              >
                <View className="w-40 shrink-0 border-r border-border">
                  <ScrollView className="flex-1" testID="porcelain-settings-dialog-nav">
                    {SETTINGS_SCOPE_ORDER.map((scope) => {
                      const grouped = SETTINGS_SECTIONS.filter((entry) => entry.scope === scope)
                      if (grouped.length === 0) return null
                      return (
                        <View key={scope} className="gap-1 px-2 py-3">
                          <Text className="px-2 pb-1 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                            {SETTINGS_SCOPE_LABEL[scope]}
                          </Text>
                          {grouped.map((entry) => {
                            const selected = entry.id === section.id
                            return (
                              <Pressable
                                key={entry.id}
                                accessibilityLabel={entry.label}
                                accessibilityRole="tab"
                                accessibilityState={{ selected }}
                                className={cn(
                                  'min-h-9 justify-center rounded-md px-2',
                                  selected ? 'bg-accent' : 'active:bg-accent/40',
                                )}
                                testID={entry.testID}
                                onPress={() => {
                                  setSection(entry.id)
                                }}
                              >
                                <Text
                                  className={cn(
                                    'text-sm',
                                    selected
                                      ? 'font-medium text-accent-foreground'
                                      : 'text-foreground',
                                  )}
                                >
                                  {entry.label}
                                </Text>
                              </Pressable>
                            )
                          })}
                        </View>
                      )
                    })}
                  </ScrollView>
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-start gap-2 border-b border-border px-5 py-4">
                    <View className="min-w-0 flex-1 gap-1">
                      <Text className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                        {SETTINGS_SCOPE_LABEL[section.scope]}
                      </Text>
                      <Text className="text-base font-semibold text-foreground">
                        {section.title}
                      </Text>
                      <Text className="text-xs text-muted-foreground">{section.blurb}</Text>
                    </View>
                    <IconAction
                      accessibilityLabel="Close Settings"
                      glyph="close"
                      testID="porcelain-settings-dialog-close"
                      tone="foreground"
                      onPress={closeSettings}
                    />
                  </View>
                  {/* surface-gutter-allow: this scrolls a dialog body, not a product surface. */}
                  <ScrollView className="min-h-0 flex-1" contentContainerStyle={{ padding: 20 }}>
                    <SettingsSectionBody section={section.id} />
                  </ScrollView>
                </View>
              </View>
            </DialogPrimitive.Content>
          </Pressable>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
