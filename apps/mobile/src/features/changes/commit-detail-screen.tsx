import { Host, List, Section, Text, VStack } from '@expo/ui/swift-ui'
import { font, listStyle, padding } from '@expo/ui/swift-ui/modifiers'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useMemo } from 'react'
import { StyleSheet, useColorScheme, View } from 'react-native'

import { DaemonGate } from '@/components/daemon-gate'
import { EntryCanvas } from '@/components/entry-canvas'
import type { EntryItem, EntryTarget } from '@/components/entry-rows'
import { HeaderToolbar } from '@/components/header-toolbar'
import { ScreenHost } from '@/components/screen-host'
import { QueryNotice } from '@/features/changes/components/query-notice'
import { useCommitMessage, useScopeFlow } from '@/features/changes/data/queries'
import { flowEntryItems } from '@/features/changes/lib/flow-rows'
import { shortHash, splitMessage } from '@/features/changes/lib/format'
import { firstParam } from '@/features/changes/lib/scope'
import { accentColor } from '@/theme/colors'
import { footnote, secondary } from '@/theme/modifiers'
import { useAccentColor } from '@/theme/use-accent-color'

const headline = font({ textStyle: 'headline' })
const ALL_CHANGES_KEY = 'item:all-changes'

/**
 * One historical commit: its message, then the same flow-grouped file list the working tree uses.
 * Commit scope has no staging, reviewed marks or discard — the components simply are not given
 * them. The message keeps a SwiftUI block of its own because prose has to wrap, and the canvas
 * below pans instead of wrapping.
 */
export function CommitDetailScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ author?: string; date?: string; hash: string }>()
  const hash = firstParam(params.hash)
  const author = firstParam(params.author)
  const date = firstParam(params.date)

  return (
    <>
      <Stack.Screen options={{ title: shortHash(hash) }} />
      <DaemonGate requires="repo">
        <CommitBody author={author} date={date} hash={hash} />
      </DaemonGate>
      <HeaderToolbar />
    </>
  )
}

function CommitBody({
  author,
  date,
  hash,
}: {
  author: string
  date: string
  hash: string
}): React.JSX.Element {
  const message = useCommitMessage(hash)
  const flow = useScopeFlow({ hash, type: 'commit' })
  const seedColor = useAccentColor()
  const accent = accentColor(useColorScheme() === 'dark' ? 'dark' : 'light')
  const groups = flow.data ?? []
  const { body, subject } = splitMessage(message.data ?? '')

  const items = useMemo(
    (): EntryItem[] => [
      {
        key: ALL_CHANGES_KEY,
        kind: 'item',
        name: 'All changes',
        symbol: { name: 'text.alignleft', tint: accent },
        trailing: [{ text: 'every changed file in flow order' }],
      },
      ...flowEntryItems(groups),
    ],
    [accent, groups],
  )

  if (groups.length === 0) {
    return (
      <ScreenHost>
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section>
            <QueryNotice
              description="This commit touched no files the daemon can group."
              error={flow.error ?? message.error}
              isPending={flow.isPending}
              onRetry={(): void => {
                flow.refetch()
              }}
              symbol="doc.text"
              title="No files"
            />
          </Section>
        </List>
      </ScreenHost>
    )
  }

  return (
    <View style={styles.root}>
      <Host matchContents seedColor={seedColor}>
        <VStack alignment="leading" modifiers={[padding({ all: 16 })]} spacing={4}>
          <Text modifiers={[headline]}>{subject === '' ? shortHash(hash) : subject}</Text>
          {body === '' ? null : <Text modifiers={[footnote, secondary]}>{body}</Text>}
          {author === '' && date === '' ? null : (
            <Text modifiers={[footnote, secondary]}>
              {[author, date].filter(Boolean).join(' · ')}
            </Text>
          )}
        </VStack>
      </Host>
      <EntryCanvas
        contentKey={`commit:${hash}`}
        items={items}
        onPress={(item: EntryTarget): void => {
          if (item.key === ALL_CHANGES_KEY) {
            router.push({ params: { hash, scope: 'commit' }, pathname: '/reading' })
            return
          }
          if (item.kind === 'item') return
          router.push({ params: { hash, path: item.path, scope: 'commit' }, pathname: '/file' })
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
})
