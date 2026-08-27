import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { IconAction, PanelLabel, StatusNote } from '@/components/panel-chrome'
import { useDismissSheet } from '@/features/shell/shell-sheets'
import { cn } from '@/lib/utils'

import { pathSegments, pathTestId } from './file-paths'
import { type FileEntry, usePathScope, usePinnedEntries } from './files-data'

/**
 * The Files companion — pinned paths for quick access.
 *
 * On a phone this is the bolt sheet's whole content. On a tablet there is no companion column
 * any more: the web client stacks its pins directly above the tree inside the Files surface
 * (`FilesSurface` in `apps/web`'s `shell/surface-sidebar.tsx`), and the tablet's Surfaces panel
 * now does the same by mounting `PinnedSection` itself. One section, two hosts, and neither one
 * a second panel to go and find.
 */
export function FilesCompanion({ active }: { active: boolean }): React.JSX.Element {
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-5 px-4 pb-8 pt-3"
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      testID="porcelain-files-companion"
    >
      <PinnedSection active={active} />
    </ScrollView>
  )
}

/**
 * The project's pinned paths. Pinning is how a monorepo gets a short list of the places you
 * actually work — the surface's own bookmarks, stored per project on the daemon rather than
 * here, and shared with the desktop client.
 */
export function PinnedSection({
  active,
  compact = false,
}: {
  active: boolean
  /**
   * Sitting above the tree rather than alone in a sheet: draw nothing until there is something
   * to draw. The explanatory empty state is worth a sheet you opened on purpose; above a tree
   * it is a paragraph between you and the thing you came for, on every project with no pins.
   */
  compact?: boolean
}): React.JSX.Element | null {
  const { entries, error } = usePinnedEntries(active)
  const { unpin } = usePathScope()
  const closeSheet = useDismissSheet()
  const router = useRouter()
  const [actionError, setActionError] = useState<string | null>(null)

  // One path for both hosts: get out of the way if we are covering something (the phone's
  // sheet), then open the entry in the viewer. `useDismissSheet` is inert in a panel.
  const open = (entry: FileEntry): void => {
    closeSheet()
    router.push({
      params: { path: pathSegments(entry.path) },
      pathname: entry.kind === 'dir' ? '/folder/[...path]' : '/file/[...path]',
    })
  }

  return (
    // Compact draws its own band because it is stacked ON something: without the rule the pins
    // and the first tree row read as one list. The sheet is the whole panel and needs no edge.
    <View
      className={cn('gap-2', compact && 'shrink-0 border-b border-border px-4 py-3')}
      testID="porcelain-files-pinned"
    >
      <PanelLabel>{entries.length > 0 ? `Pinned · ${entries.length}` : 'Pinned'}</PanelLabel>

      {error !== null ? (
        <Text className="text-2xs leading-4 text-destructive">{error.message}</Text>
      ) : entries.length === 0 ? (
        <Text className="text-2xs leading-4 text-muted-foreground">
          Long-press a file or folder in the tree and pin it. Pins are per project and shared with
          the desktop app.
        </Text>
      ) : (
        <View className="gap-1">
          {entries.map((entry) => (
            <View key={entry.path} className="flex-row items-center gap-1">
              <Pressable
                accessibilityLabel={`Open ${entry.path}`}
                accessibilityRole="button"
                className="min-h-10 min-w-0 flex-1 flex-row items-center gap-2 rounded-xl px-2 py-1.5 active:bg-accent"
                testID={pathTestId('porcelain-files-pinned-entry', entry.path)}
                onPress={() => {
                  open(entry)
                }}
              >
                <ChromeGlyph
                  name={entry.kind === 'dir' ? 'folderFill' : 'file'}
                  size={14}
                  tone={entry.kind === 'dir' ? 'primary' : 'muted'}
                />
                <View className="min-w-0 flex-1">
                  <Text className="font-mono text-xs text-foreground" numberOfLines={1}>
                    {entry.name}
                  </Text>
                  <Text
                    className="font-mono text-3xs text-muted-foreground"
                    ellipsizeMode="head"
                    numberOfLines={1}
                  >
                    {entry.path}
                  </Text>
                </View>
              </Pressable>
              <IconAction
                accessibilityLabel={`Unpin ${entry.name}`}
                glyph="pinOff"
                testID={pathTestId('porcelain-files-unpin', entry.path)}
                onPress={() => {
                  setActionError(null)
                  unpin(entry.path).catch((cause: unknown) => {
                    setActionError(
                      `Unpin failed: ${cause instanceof Error ? cause.message : String(cause)}`,
                    )
                  })
                }}
              />
            </View>
          ))}
        </View>
      )}

      {actionError === null ? null : (
        <StatusNote failed testID="porcelain-files-pinned-error" text={actionError} />
      )}
    </View>
  )
}
