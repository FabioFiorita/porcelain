import { ScrollView, Text, View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Text as UiText } from '@/components/ui/text'
import { cn } from '@/lib/utils'

import { MOCK_ENVIRONMENTS } from './mock-data'
import { PhoneHeader } from './phone-header'
import { ChromeGlyph } from './shell-icon'
import { type SettingsSection, useShellStore } from './shell-store'

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'review', label: 'Review' },
  { id: 'environments', label: 'Environments' },
]

/**
 * Phone Settings tab — full-screen (not a sheet). Segmented tabs under the
 * header (not a sidebar): phone width is too tight for a rail + panel split.
 */
export function SettingsScreen(): React.JSX.Element {
  const section = useShellStore((state) => state.settingsSection)
  const setSettingsSection = useShellStore((state) => state.setSettingsSection)

  return (
    <View className="flex-1 bg-background" testID="porcelain-phone-settings">
      <PhoneHeader title="Settings" workspace={false} />

      <Tabs
        className="min-h-0 flex-1 gap-0"
        onValueChange={(value) => {
          setSettingsSection(value as SettingsSection)
        }}
        value={section}
      >
        <View className="border-b border-border px-4 pb-3 pt-2">
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

        {SECTIONS.map((entry) => (
          <TabsContent key={entry.id} className="min-h-0 flex-1" value={entry.id}>
            <ScrollView
              className="flex-1"
              contentContainerClassName="gap-3 px-4 py-4 pb-10"
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
