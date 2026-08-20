import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { IconAction, PanelLabel, StatusNote } from '@/components/panel-chrome'
import { useIsTablet } from '@/features/shell/use-app-window'

import { pathSegments, pathTestId } from './file-paths'
import { type FileEntry, usePathScope, usePinnedEntries } from './files-data'
import { useFilesStore } from './files-store'
import { useDismissSheet } from '@/features/shell/shell-sheets'

/**
 * The Files companion — pinned paths for quick access.
 *
 * One component for both hosts, the tablet inspector column and the phone's bolt sheet, so the
 * two can never drift into different companions for the same surface.
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
      <PinnedCard active={active} />
    </ScrollView>
  )
}

/**
 * The project's pinned paths. Pinning is how a monorepo gets a short list of the places you
 * actually work — the tab's own bookmarks, stored per project on the daemon rather than here.
 */
function PinnedCard({ active }: { active: boolean }): React.JSX.Element {
  const { entries, error } = usePinnedEntries(active)
  const { unpin } = usePathScope()
  const openDir = useFilesStore((state) => state.openDir)
  const openFile = useFilesStore((state) => state.openFile)
  const closeSheet = useDismissSheet()
  const isTablet = useIsTablet()
  const router = useRouter()
  const [actionError, setActionError] = useState<string | null>(null)

  // The same card hosted two ways: an always-on inspector column beside the tree, and a sheet
  // over the phone's tab. The tablet moves its columns' cursor; the phone dismisses itself and
  // pushes, because a sheet that stays open over the file it just opened is a sheet in the way.
  const open = (entry: FileEntry): void => {
    if (isTablet) {
      if (entry.kind === 'dir') openDir(entry.path)
      else openFile(entry.path)
      return
    }
    closeSheet()
    router.push({
      params: { path: pathSegments(entry.path) },
      pathname: entry.kind === 'dir' ? '/folder/[...path]' : '/file/[...path]',
    })
  }

  return (
    <View className="gap-2" testID="porcelain-files-pinned">
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
