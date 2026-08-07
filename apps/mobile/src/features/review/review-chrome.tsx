import { ScrollView, Text, View } from 'react-native'

import { PanelLabel } from '@/components/panel-chrome'
import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'
import { pathTestId } from '@/features/files/file-paths'
import type { FileSource } from '@/lib/daemon/procedures/review'

/**
 * Chrome the three Review canvases share: the source marker, the document tab strip, and
 * the agent's per-file note.
 */

const SOURCE_LABEL: Record<FileSource, string> = {
  changed: 'changed',
  context: 'context',
  shipped: 'shipped',
}

/**
 * Why a file is in the Review, as a shape rather than a word — the same three marks the web
 * outline uses, so the two clients read alike: a filled dot changed, a diamond shipped
 * earlier, a hollow ring is context the agent wants you to have.
 */
export function SourceMarker({ source }: { source: FileSource }): React.JSX.Element {
  if (source === 'changed') {
    return <View className="size-2 shrink-0 rounded-full bg-primary" />
  }
  if (source === 'shipped') {
    return <View className="size-1.5 shrink-0 rotate-45 bg-info" />
  }
  return <View className="size-2 shrink-0 rounded-full border border-muted-foreground/70" />
}

/** The legend above the canvas: how many unique files of each kind this Review carries. */
export function SourceCounts({
  counts,
  testID,
}: {
  counts: Record<FileSource, number>
  testID: string
}): React.JSX.Element {
  return (
    <View className="flex-row items-center gap-3" testID={testID}>
      {(['changed', 'context', 'shipped'] as const).map((source) => (
        <View key={source} className="flex-row items-center gap-1.5">
          <SourceMarker source={source} />
          <Text className="text-[10px] text-muted-foreground">
            {counts[source]} {SOURCE_LABEL[source]}
          </Text>
        </View>
      ))}
    </View>
  )
}

export type DocTab = {
  /** Stable identity — a file name or a pane key, never a render position. */
  key: string
  label: string
}

/**
 * The strip over a document set: Intent's panes, Evidence's report plus its extra pages.
 *
 * Horizontally scrollable rather than segmented, because the count is the agent's to choose —
 * a review may publish one `index.md` or a dozen pages, and a control that divides the width
 * between them stops being tappable at four.
 */
export function DocTabs({
  onChange,
  tabs,
  testIDPrefix,
  value,
}: {
  onChange: (key: string) => void
  tabs: readonly DocTab[]
  testIDPrefix: string
  value: string
}): React.JSX.Element {
  return (
    <ScrollView
      className="max-h-12 shrink-0 grow-0 border-b border-border"
      contentContainerClassName="items-center gap-1 px-4 py-1.5"
      horizontal
      showsHorizontalScrollIndicator={false}
      testID={testIDPrefix}
    >
      {tabs.map((tab) => (
        <Button
          key={tab.key}
          accessibilityLabel={tab.label}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab.key === value }}
          size="sm"
          testID={pathTestId(testIDPrefix, tab.key)}
          variant={tab.key === value ? 'secondary' : 'ghost'}
          onPress={() => {
            onChange(tab.key)
          }}
        >
          <UiText className="text-xs">{tab.label}</UiText>
        </Button>
      ))}
    </ScrollView>
  )
}

/** The agent's note about a file — why it is here, in its own words. */
export function FileNote({ note, testID }: { note: string; testID: string }): React.JSX.Element {
  return (
    <View
      className="mx-3 my-1 gap-1 rounded-xl border border-border bg-muted/60 px-2.5 py-2"
      testID={testID}
    >
      <PanelLabel>Note</PanelLabel>
      <Text className="text-xs leading-5 text-muted-foreground">{note}</Text>
    </View>
  )
}

/** Lines the daemon elided between two slices. Drawn, so two ranges never read as adjacent. */
export function GapRow({ lines }: { lines: number }): React.JSX.Element {
  return (
    <View className="flex-row items-center gap-2 bg-muted/40 px-2 py-1">
      <Text className="font-mono text-[10px] leading-4 text-muted-foreground">⋯</Text>
      <Text className="font-mono text-[10px] leading-4 text-muted-foreground">
        {lines} {lines === 1 ? 'line' : 'lines'} not shown
      </Text>
    </View>
  )
}
