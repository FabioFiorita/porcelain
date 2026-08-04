import { Pressable, ScrollView, Text, View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'
import { cn } from '@/lib/utils'

import { MOCK_ENVIRONMENTS } from './mock-data'
import { PhoneHeader } from './phone-header'
import { ChromeGlyph } from './shell-icon'
import { type SettingsSection, useShellStore } from './shell-store'

/**
 * Phone Settings tab — full-screen (not a sheet). Same sections as the tablet
 * settings sheet: General · Review · Environments.
 */
export function SettingsScreen(): React.JSX.Element {
  const section = useShellStore((state) => state.settingsSection)
  const setSettingsSection = useShellStore((state) => state.setSettingsSection)

  const sections: { id: SettingsSection; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'review', label: 'Review' },
    { id: 'environments', label: 'Environments' },
  ]

  return (
    <View className="flex-1 bg-background" testID="porcelain-phone-settings">
      <PhoneHeader title="Settings" workspace={false} />

      <View className="flex-1 flex-row">
        <ScrollView
          className="w-[38%] border-r border-border bg-muted/20"
          contentContainerClassName="gap-1 px-2 py-3"
          showsVerticalScrollIndicator={false}
        >
          {sections.map((entry) => (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityState={{ selected: section === entry.id }}
              className={cn(
                'rounded-xl border border-transparent px-3 py-3 active:bg-accent',
                section === entry.id && 'border-border bg-card',
              )}
              testID={`porcelain-settings-section-${entry.id}`}
              onPress={() => {
                setSettingsSection(entry.id)
              }}
            >
              <Text
                className={cn(
                  'text-sm font-medium',
                  section === entry.id ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {entry.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-3 px-4 py-4 pb-10"
          showsVerticalScrollIndicator={false}
        >
          {section === 'general' ? <GeneralSettings /> : null}
          {section === 'review' ? <ReviewSettings /> : null}
          {section === 'environments' ? <EnvironmentsSettings /> : null}
        </ScrollView>
      </View>
    </View>
  )
}

/** Shared mock panels — tablet settings sheet reuses these via shell-sheets. */
export function GeneralSettings(): React.JSX.Element {
  return (
    <View className="gap-3">
      <SettingsCard title="Appearance" body="System · Light · Dark — follows the OS for now." />
      <SettingsCard title="Diff mode" body="Unified (default). Split lands with the real viewer." />
      <SettingsCard title="Markdown" body="Reader or source when opening markdown files." />
      <SettingsCard title="HTML" body="Sandboxed preview or source for .html files." />
      <SettingsCard title="Pull strategy" body="Merge or rebase for the git pull quick command." />
    </View>
  )
}

export function ReviewSettings(): React.JSX.Element {
  return (
    <View className="gap-3">
      <SettingsCard
        title="Review layers"
        body="Docs · Agents · Other — same grouping as the web Review section."
      />
      <SettingsCard title="Empty review" body="Show Glance when no unit of work is published." />
    </View>
  )
}

export function EnvironmentsSettings(): React.JSX.Element {
  return (
    <View className="gap-3">
      <Text className="text-sm text-muted-foreground">
        Pair this phone with a dev daemon. Production port 43117 is never used for product work.
      </Text>
      {MOCK_ENVIRONMENTS.map((environment) => (
        <View
          key={environment.id}
          className={cn(
            'flex-row items-center gap-3 rounded-xl border border-border bg-card p-3',
            environment.active && 'border-primary/40 bg-primary/5',
          )}
        >
          <View className="size-9 items-center justify-center rounded-lg bg-muted">
            <ChromeGlyph name="network" size={16} tone="foreground" />
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="font-medium text-foreground">{environment.name}</Text>
            <Text className="text-xs text-muted-foreground">{environment.host}</Text>
          </View>
          {environment.active ? (
            <Text className="text-xs font-semibold text-primary">Active</Text>
          ) : null}
        </View>
      ))}
      <Button variant="outline">
        <UiText>Add environment…</UiText>
      </Button>
    </View>
  )
}

function SettingsCard({ title, body }: { title: string; body: string }): React.JSX.Element {
  return (
    <View className="gap-1 rounded-xl border border-border bg-muted/40 p-3">
      <Text className="text-sm font-semibold text-foreground">{title}</Text>
      <Text className="text-sm leading-5 text-muted-foreground">{body}</Text>
    </View>
  )
}
