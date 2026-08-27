import { ScrollView, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { ResponsiveHubDialog } from '@/features/hub/responsive-hub-dialog'

import { useMobileWorktreeProfile } from './personalization-read'
import { usePersonalizationStore } from './personalization-store'

function Paths({ empty, paths }: { empty: string; paths: readonly string[] }): React.JSX.Element {
  if (paths.length === 0) {
    return <Text className="text-xs italic text-muted-foreground">{empty}</Text>
  }
  return (
    <View className="gap-0.5">
      {paths.map((path) => (
        <Text key={path} className="font-mono text-xs text-foreground">
          {path}
        </Text>
      ))}
    </View>
  )
}

export function PersonalizationSheet(): React.JSX.Element {
  const target = usePersonalizationStore((state) => state.target)
  const close = usePersonalizationStore((state) => state.close)
  const { error, isLoading, profile } = useMobileWorktreeProfile(
    target?.environmentId ?? null,
    target?.projectPath ?? null,
  )

  return (
    <ResponsiveHubDialog
      description="Project-wide navigation choices and Review presentation."
      open={target !== null}
      testID="porcelain-personalization-sheet"
      title="Personalization"
      onClose={close}
    >
      <ScrollView className="min-h-0 flex-1" contentContainerClassName="gap-6 px-5 py-5">
        {target === null ? null : (
          <Text className="font-mono text-2xs text-muted-foreground">{target.projectPath}</Text>
        )}
        <View className="gap-3">
          <View className="gap-1">
            <Text className="text-sm font-semibold text-foreground">Files</Text>
            <Text className="text-xs text-muted-foreground">
              Pins and hidden paths are choices you make in the Files tree. They apply across this
              project and Porcelain preserves them.
            </Text>
          </View>
          {isLoading ? <Text className="text-xs text-muted-foreground">Reading…</Text> : null}
          {error === null ? null : (
            <Text className="text-xs text-destructive">{error.message}</Text>
          )}
          {profile === undefined ? null : (
            <>
              <View className="gap-1">
                <Text className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                  Pinned
                </Text>
                <Paths empty="Nothing pinned." paths={profile.base.pinnedPaths} />
              </View>
              <View className="gap-1">
                <Text className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                  Hidden
                </Text>
                <Paths empty="Nothing hidden." paths={profile.base.hiddenPaths} />
              </View>
            </>
          )}
        </View>
        <View
          className="gap-2 border-t border-border pt-5"
          testID="porcelain-personalization-agent-built"
        >
          <Text className="text-sm font-semibold text-foreground">
            Story order is built into each Review
          </Text>
          <Text className="text-xs text-muted-foreground">
            Ask an agent to use Porcelain and the companion skill can arrange that Review Canvas for
            the change. There is no prompt to copy back to the agent.
          </Text>
        </View>
      </ScrollView>
    </ResponsiveHubDialog>
  )
}
