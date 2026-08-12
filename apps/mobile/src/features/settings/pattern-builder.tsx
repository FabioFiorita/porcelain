import type { Layer } from '@porcelain/contracts/project-data'
import { View } from 'react-native'
import { PanelLabel } from '@/components/panel-chrome'
import { SegmentedControl } from '@/components/segmented-control'
import { PANEL_CARD } from '@/components/surface-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

import { EXAMPLE_LIMIT, MATCH_HELP, type MatchType, PLACEHOLDERS } from './review-layers'
import { usePatternBuilder } from './use-review-editor'

const MATCH_OPTIONS: { value: MatchType; label: string }[] = [
  { label: 'Folder', value: 'folder' },
  { label: 'Extension', value: 'ext' },
  { label: 'Suffix', value: 'suffix' },
]

/**
 * Writes one layer's regex so the reader does not have to. The preview under the field is the
 * point: a pattern is only trustworthy once you have seen which of today's changed files it
 * claims.
 */
export function PatternBuilder({
  onAdd,
  changedPaths,
}: {
  onAdd: (layer: Layer) => void
  changedPaths: readonly string[]
}): React.JSX.Element {
  const builder = usePatternBuilder(changedPaths, onAdd)
  const { matches } = builder

  return (
    <View className={cn(PANEL_CARD, 'gap-2.5 p-3')} testID="porcelain-settings-pattern-builder">
      <PanelLabel>Pattern builder</PanelLabel>
      <View className="gap-1.5">
        <Text className="text-xs text-muted-foreground">Match</Text>
        <SegmentedControl<MatchType>
          options={MATCH_OPTIONS}
          value={builder.matchType}
          onChange={builder.setMatchType}
        />
      </View>
      <View className="gap-1.5">
        <Text className="text-xs text-muted-foreground">Names</Text>
        <Input
          accessibilityLabel="Pattern names"
          autoCapitalize="none"
          autoCorrect={false}
          className="h-9"
          placeholder={PLACEHOLDERS[builder.matchType]}
          testID="porcelain-settings-pattern-names"
          value={builder.names}
          onChangeText={builder.setNames}
          onSubmitEditing={builder.add}
        />
      </View>
      <View className="flex-row items-center gap-2">
        <View className="min-w-0 flex-1 rounded-md bg-muted px-2 py-1.5">
          <Text className="font-mono text-xs text-foreground" numberOfLines={1}>
            {builder.preview || '—'}
          </Text>
        </View>
        <Button disabled={builder.parsed.length === 0} size="sm" onPress={builder.add}>
          <Text>Add</Text>
        </Button>
      </View>
      <Text className="text-xs leading-4 text-muted-foreground">
        {MATCH_HELP[builder.matchType]}
      </Text>
      {builder.parsed.length > 0 ? (
        <View className="gap-0.5 rounded-md bg-muted px-2.5 py-2">
          {changedPaths.length === 0 ? (
            <Text className="text-xs text-muted-foreground">
              No changed files to preview against right now.
            </Text>
          ) : matches.length === 0 ? (
            <Text className="text-xs text-warning">
              No changed files match this pattern — try a different match type above.
            </Text>
          ) : (
            <>
              <PanelLabel>
                {`Matches ${matches.length} changed ${matches.length === 1 ? 'file' : 'files'}`}
              </PanelLabel>
              {matches.slice(0, EXAMPLE_LIMIT).map((path) => (
                <Text key={path} className="font-mono text-xs text-foreground" numberOfLines={1}>
                  {path}
                </Text>
              ))}
              {matches.length > EXAMPLE_LIMIT ? (
                <Text className="text-xs text-muted-foreground">
                  +{matches.length - EXAMPLE_LIMIT} more
                </Text>
              ) : null}
            </>
          )}
        </View>
      ) : null}
      <Text className="text-xs leading-4 text-muted-foreground">
        Furthest-right match wins; unmatched files fall into Other. You can still edit any pattern
        by hand below.
      </Text>
    </View>
  )
}
