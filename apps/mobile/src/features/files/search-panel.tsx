import { dirName, fileName } from '@porcelain/client-runtime/paths'
import { useEffect, useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { EmptyNote, ErrorNote } from '@/components/panel-chrome'
import { Input } from '@/components/ui/input'
import type { FileSearchResult } from '@/lib/daemon/procedures/files'
import { cn } from '@/lib/utils'

import { pathTestId } from './file-paths'
import { useFilesStore } from './files-store'
import { useFileSearch } from './use-files'

/** A settled query costs one daemon round trip; a keystroke-per-request costs one each. */
const DEBOUNCE_MS = 150

/**
 * Find a file by name — the Files tab's second face, and this client's answer to the desktop's
 * ⌘P finder.
 *
 * A face rather than a permanent field in the header: a phone has one column of vertical space,
 * and a search box that is always on screen spends it on something you use for five seconds at
 * a time. Re-tapping the Files tab flips here and back.
 *
 * The query lives in the store so it survives the flip and so the tablet's results and viewer
 * agree on it; only the daemon read is debounced.
 */
export function SearchPanel({
  active,
  bottomInset = 0,
  onOpenDir,
  onOpenFile,
  selectedPath = null,
}: {
  active: boolean
  /** Phone: room for the floating tab bar the list scrolls under. */
  bottomInset?: number
  onOpenDir: (path: string) => void
  onOpenFile: (path: string) => void
  /** Tablet: the file the viewer column is showing. */
  selectedPath?: string | null
}): React.JSX.Element {
  const query = useFilesStore((state) => state.query)
  const setQuery = useFilesStore((state) => state.setQuery)
  const [settled, setSettled] = useState(query)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(query)
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [query])

  const { error, isLoading, results } = useFileSearch(settled, active)
  const trimmed = query.trim()
  // Typing past a settled query is a search in flight as far as the reader is concerned, even
  // though no request has left yet.
  const searching = isLoading || trimmed !== settled.trim()

  return (
    <View className="flex-1" testID="porcelain-search-panel">
      <View className="px-3 pb-2 pt-1">
        <View className="flex-row items-center gap-2 rounded-xl border border-border bg-muted/40 px-3">
          <ChromeGlyph name="search" size={16} />
          <Input
            accessibilityLabel="Search files by name"
            autoCapitalize="none"
            autoCorrect={false}
            className="native:h-11 flex-1 border-0 bg-transparent px-0 shadow-none"
            placeholder="Find a file by name…"
            returnKeyType="search"
            testID="porcelain-search-input"
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      {error === null ? null : (
        <View className="px-3 pb-2">
          <ErrorNote message={error.message} testID="porcelain-search-error" />
        </View>
      )}

      {trimmed === '' ? (
        <EmptyNote
          body="Fuzzy match on the path — “mobshell” finds apps/mobile/src/features/shell."
          testID="porcelain-search-idle"
          title="Search the repo"
        />
      ) : results.length === 0 ? (
        <Text
          className="px-4 py-6 text-center text-sm text-muted-foreground"
          testID="porcelain-search-empty"
        >
          {searching ? 'Searching…' : `No file matches “${trimmed}”.`}
        </Text>
      ) : (
        <FlatList
          contentContainerClassName="gap-0.5 px-2 pb-8"
          contentContainerStyle={{ paddingBottom: bottomInset }}
          data={results}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(result: FileSearchResult) => `${result.kind}:${result.path}`}
          renderItem={({ item }) => (
            <SearchRow
              result={item}
              selected={item.path === selectedPath}
              onOpen={() => {
                if (item.kind === 'dir') onOpenDir(item.path)
                else onOpenFile(item.path)
              }}
            />
          )}
          testID="porcelain-search-results"
        />
      )}
    </View>
  )
}

function SearchRow({
  onOpen,
  result,
  selected,
}: {
  onOpen: () => void
  result: FileSearchResult
  selected: boolean
}): React.JSX.Element {
  const directory = dirName(result.path)

  return (
    <Pressable
      accessibilityLabel={`${result.kind === 'dir' ? 'Folder' : 'File'} ${result.path}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        'min-h-12 flex-row items-center gap-2.5 rounded-xl border border-transparent px-3 py-2 active:bg-accent',
        selected && 'border-border bg-muted/70',
      )}
      testID={pathTestId('porcelain-search-result', result.path)}
      onPress={onOpen}
    >
      <ChromeGlyph
        name={result.kind === 'dir' ? 'folderFill' : 'file'}
        size={15}
        tone={result.kind === 'dir' ? 'primary' : 'muted'}
      />
      <View className="min-w-0 flex-1">
        <Text className="font-mono text-[13px] text-foreground" numberOfLines={1}>
          {fileName(result.path)}
        </Text>
        {directory === '' ? null : (
          // Head-truncated: the tail of a path is what tells two matches apart.
          <Text
            className="font-mono text-[11px] text-muted-foreground"
            ellipsizeMode="head"
            numberOfLines={1}
          >
            {directory}
          </Text>
        )}
      </View>
    </Pressable>
  )
}
