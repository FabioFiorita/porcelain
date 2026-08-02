import { Host, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import { font, frame, padding } from '@expo/ui/swift-ui/modifiers'
import { setStringAsync } from 'expo-clipboard'
import { type Href, Link } from 'expo-router'
import type { ListRenderItem, ListRenderItemInfo } from 'react-native'
import { FlatList, Pressable, StyleSheet } from 'react-native'

import { ScreenHost } from '@/components/screen-host'
import type { DirEntry } from '@/lib/daemon/procedures/files'
import { entryHref, hrefForAbsolutePath, repoRelativePath } from './file-paths'
import type { FileEntryActions } from './use-files'

type FileListSection = {
  key: string
  type: 'section'
  title: string
}

type FileListEntry = {
  detail?: string
  entry: DirEntry
  key: string
  type: 'entry'
}

type FileListItem = FileListSection | FileListEntry

export function EntryList({
  actions,
  entries,
  detailForEntry,
  pinnedEntries = [],
  repoPath,
}: {
  actions: FileEntryActions
  entries: readonly DirEntry[]
  detailForEntry?: (entry: DirEntry) => string | undefined
  pinnedEntries?: readonly DirEntry[]
  repoPath: string
}): React.JSX.Element {
  const items = makeItems(entries, pinnedEntries, detailForEntry)

  return (
    <ScreenHost>
      <HostRNList actions={actions} items={items} repoPath={repoPath} />
    </ScreenHost>
  )
}

function HostRNList({
  actions,
  items,
  repoPath,
}: {
  actions: FileEntryActions
  items: readonly FileListItem[]
  repoPath: string
}): React.JSX.Element {
  const renderItem: ListRenderItem<FileListItem> = ({ item }: ListRenderItemInfo<FileListItem>) => {
    if (item.type === 'section') return <SectionRow title={item.title} />
    return (
      <EntryRow actions={actions} detail={item.detail} entry={item.entry} repoPath={repoPath} />
    )
  }

  return (
    <FlatList
      contentContainerStyle={styles.listContent}
      contentInsetAdjustmentBehavior="automatic"
      data={items}
      keyExtractor={(item: FileListItem): string => item.key}
      renderItem={renderItem}
      showsVerticalScrollIndicator
    />
  )
}

function EntryRow({
  actions,
  detail,
  entry,
  repoPath,
}: {
  actions: FileEntryActions
  detail?: string
  entry: DirEntry
  repoPath: string
}): React.JSX.Element {
  const href = hrefForEntry(repoPath, entry)
  const label = entry.kind === 'dir' ? 'Folder' : 'File'
  const status = detail ?? statusLabel(entry)
  const copyPath = (): void => {
    copyDaemonPath(entry.path)
  }

  return (
    <Link asChild href={href}>
      <Link.Trigger>
        <Pressable
          accessibilityLabel={`${entry.name}, ${label}`}
          accessibilityRole="button"
          style={styles.row}
        >
          <Host style={styles.rowHost}>
            <HStack
              alignment="center"
              modifiers={[
                frame({ maxWidth: Infinity, alignment: 'leading' }),
                padding({ horizontal: 16, vertical: 10 }),
              ]}
              spacing={12}
            >
              <Image size={20} systemName={entry.kind === 'dir' ? 'folder.fill' : 'doc.text'} />
              <VStack
                alignment="leading"
                modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
                spacing={2}
              >
                <Text modifiers={[font({ textStyle: 'body' })]}>{entry.name}</Text>
                {status === undefined ? null : (
                  <Text modifiers={[font({ textStyle: 'footnote' })]}>{status}</Text>
                )}
              </VStack>
              <Spacer />
              <Image size={13} systemName="chevron.right" />
            </HStack>
          </Host>
        </Pressable>
      </Link.Trigger>
      <Link.Menu>
        <Link.MenuAction
          icon={entry.pinned ? 'pin.slash' : 'pin'}
          isOn={entry.pinned}
          onPress={(): void => {
            if (entry.pinned) actions.unpin(entry.path)
            else actions.pin(entry.path)
          }}
        >
          {entry.pinned ? 'Unpin' : 'Pin'}
        </Link.MenuAction>
        <Link.MenuAction
          icon={entry.hidden ? 'eye' : 'eye.slash'}
          onPress={(): void => {
            if (entry.hidden) actions.unhide(entry.path)
            else actions.hide(entry.path)
          }}
        >
          {entry.hidden ? 'Unhide' : 'Hide'}
        </Link.MenuAction>
        <Link.MenuAction icon="doc.on.doc" onPress={copyPath}>
          Copy path
        </Link.MenuAction>
      </Link.Menu>
      {entry.kind === 'dir' ? <Link.Preview /> : null}
    </Link>
  )
}

function SectionRow({ title }: { title: string }): React.JSX.Element {
  return (
    <Host style={styles.sectionHost}>
      <Text
        modifiers={[
          font({ textStyle: 'footnote', weight: 'semibold' }),
          padding({ horizontal: 16, vertical: 8 }),
        ]}
      >
        {title}
      </Text>
    </Host>
  )
}

function hrefForEntry(repoPath: string, entry: DirEntry): Href {
  const relative = repoRelativePath(repoPath, entry.path)
  return relative === null || relative === ''
    ? hrefForAbsolutePath(repoPath, entry.path, entry.kind)
    : entryHref(entry.kind, relative)
}

function makeItems(
  entries: readonly DirEntry[],
  pinnedEntries: readonly DirEntry[],
  detailForEntry?: (entry: DirEntry) => string | undefined,
): FileListItem[] {
  const pinned = uniqueEntries(pinnedEntries)
  const pinnedPaths = new Set(pinned.map((entry) => entry.path))
  const regular = entries.filter((entry) => !pinnedPaths.has(entry.path))
  const items: FileListItem[] = []

  if (pinned.length > 0) {
    items.push({ key: 'section:pinned', title: 'Pinned', type: 'section' })
    items.push(
      ...pinned.map((entry) => ({ entry, key: `pinned:${entry.path}`, type: 'entry' as const })),
    )
  }
  items.push(
    ...regular.map((entry) => ({
      detail: detailForEntry?.(entry),
      entry,
      key: `entry:${entry.path}`,
      type: 'entry' as const,
    })),
  )
  return items
}

function uniqueEntries(entries: readonly DirEntry[]): DirEntry[] {
  const seen = new Set<string>()
  return entries.filter((entry) => {
    if (seen.has(entry.path)) return false
    seen.add(entry.path)
    return true
  })
}

function statusLabel(entry: DirEntry): string | undefined {
  if (entry.pinned && entry.hidden) return 'Pinned · Hidden'
  if (entry.pinned) return 'Pinned'
  if (entry.hidden) return 'Hidden'
  return undefined
}

async function copyDaemonPath(path: string): Promise<void> {
  try {
    await setStringAsync(path)
  } catch {
    // Clipboard access is best effort; the context menu should still dismiss cleanly.
  }
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 28,
  },
  row: {
    minHeight: 56,
    width: '100%',
  },
  rowHost: {
    flex: 1,
  },
  sectionHost: {
    minHeight: 38,
    width: '100%',
  },
})
