import { dirName, fileName } from '@porcelain/client-runtime/paths'
import { useEffect, useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { EmptyNote, ErrorNote } from '@/components/panel-chrome'
import { SegmentedControl } from '@/components/segmented-control'
import { surfaceContentStyle } from '@/components/surface-layout'
import { Input } from '@/components/ui/input'
import type { CodeSearchOptions, FileSearchResult } from '@/lib/daemon/procedures/files'
import { cn } from '@/lib/utils'

import { ContentResults } from './content-results'
import { pathTestId } from './file-paths'
import { type SearchMode, useFilesStore } from './files-store'
import { useCodeSearch, useFileSearch } from './use-files'

/** A settled query costs one daemon round trip; a keystroke-per-request costs one each. */
const DEBOUNCE_MS = 150

/**
 * Search the repo — the Files tab's second face, and this client's answer to both desktop
 * searches at once.
 *
 * **Text** greps the repo's contents with the daemon's `searchCode`: literal or regex, case
 * on or off, narrowed by include and exclude globs, answered as per-file context hunks. That
 * is the desktop Search tab, and it is what the tab opens on. **Files** is the fuzzy path
 * match behind ⌘P, one tap away, because "where does this live" is still a question a phone
 * gets asked.
 *
 * A face rather than a permanent field in the header: a phone has one column of vertical space,
 * and a search box that is always on screen spends it on something you use for five seconds at
 * a time. Re-tapping the Files tab flips here and back.
 *
 * The query and every control live in the store so they survive the flip and so the tablet's
 * results and viewer agree on them; only the daemon read is debounced.
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
  /** `line` is 1-based and only set by a content hit — the file opens there. */
  onOpenFile: (path: string, line?: number) => void
  /** Tablet: the file the viewer column is showing. */
  selectedPath?: string | null
}): React.JSX.Element {
  const query = useFilesStore((state) => state.query)
  const setQuery = useFilesStore((state) => state.setQuery)
  const searchMode = useFilesStore((state) => state.searchMode)
  const setSearchMode = useFilesStore((state) => state.setSearchMode)
  const caseSensitive = useFilesStore((state) => state.caseSensitive)
  const regex = useFilesStore((state) => state.regex)
  const showFilters = useFilesStore((state) => state.showFilters)
  const include = useFilesStore((state) => state.include)
  const exclude = useFilesStore((state) => state.exclude)
  const toggleCaseSensitive = useFilesStore((state) => state.toggleCaseSensitive)
  const toggleRegex = useFilesStore((state) => state.toggleRegex)
  const toggleFilters = useFilesStore((state) => state.toggleFilters)
  const setInclude = useFilesStore((state) => state.setInclude)
  const setExclude = useFilesStore((state) => state.setExclude)
  const rememberSearch = useFilesStore((state) => state.rememberSearch)

  // The whole option set is debounced together: a keystroke in the exclude field is as much a
  // new search as a keystroke in the query, and each one is a `git grep` on the host.
  const [settled, setSettled] = useState<CodeSearchOptions>({
    caseSensitive,
    exclude,
    include,
    query,
    regex,
  })
  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled({ caseSensitive, exclude, include, query, regex })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [caseSensitive, exclude, include, query, regex])

  const text = useCodeSearch(settled, active && searchMode === 'text')
  const paths = useFileSearch(settled.query, active && searchMode === 'files')
  const trimmed = query.trim()
  const pending =
    settled.query !== query ||
    settled.caseSensitive !== caseSensitive ||
    settled.regex !== regex ||
    settled.include !== include ||
    settled.exclude !== exclude
  const contentMode = searchMode === 'text'
  const error = contentMode ? text.error : paths.error
  // Typing past a settled query is a search in flight as far as the reader is concerned, even
  // though no request has left yet.
  const searching = (contentMode ? text.isLoading : paths.isLoading) || pending
  const found = contentMode ? (text.result?.files.length ?? 0) > 0 : paths.results.length > 0

  // A query joins the recents once it has settled and actually found something — half-typed
  // prefixes on the way to a real search are not searches anyone wants to run again.
  useEffect(() => {
    if (found) rememberSearch(settled.query)
  }, [found, rememberSearch, settled.query])

  return (
    <View className="flex-1" testID="porcelain-search-panel">
      <View className="gap-2 px-[16px] pb-[8px] pt-[12px]">
        <SegmentedControl<SearchMode>
          options={[
            { value: 'text', label: 'Text', testID: 'porcelain-search-mode-text' },
            { value: 'files', label: 'Files', testID: 'porcelain-search-mode-files' },
          ]}
          testID="porcelain-search-mode"
          value={searchMode}
          onChange={setSearchMode}
        />

        <View className="flex-row items-center gap-1 rounded-xl border border-border bg-muted/40 pl-3 pr-1">
          <ChromeGlyph name="search" size={16} />
          <Input
            accessibilityLabel={contentMode ? 'Search file contents' : 'Search files by name'}
            autoCapitalize="none"
            autoCorrect={false}
            className="native:h-11 flex-1 border-0 bg-transparent px-0 shadow-none dark:bg-transparent"
            placeholder={contentMode ? 'Search the repo’s contents…' : 'Find a file by name…'}
            returnKeyType="search"
            testID="porcelain-search-input"
            value={query}
            onChangeText={setQuery}
          />
          {contentMode ? (
            <View className="flex-row items-center gap-0.5">
              {/* Glyph-free chips: "Aa" and ".*" are what these two mean everywhere a
                  developer has met them, and neither has an SF Symbol that reads at 17pt. */}
              <OptionChip
                accessibilityLabel="Match case"
                label="Aa"
                pressed={caseSensitive}
                testID="porcelain-search-case"
                onPress={toggleCaseSensitive}
              />
              <OptionChip
                accessibilityLabel="Use a regular expression"
                label=".*"
                pressed={regex}
                testID="porcelain-search-regex"
                onPress={toggleRegex}
              />
              <OptionChip
                accessibilityLabel="Show include and exclude filters"
                label="⋯"
                pressed={showFilters}
                testID="porcelain-search-filters-toggle"
                onPress={toggleFilters}
              />
            </View>
          ) : null}
        </View>

        {contentMode && showFilters ? (
          <View className="gap-1.5" testID="porcelain-search-filters">
            <Input
              accessibilityLabel="Files to include"
              autoCapitalize="none"
              autoCorrect={false}
              className="native:h-10 font-mono text-xs"
              placeholder="files to include (e.g. src/**, *.ts)"
              testID="porcelain-search-include"
              value={include}
              onChangeText={setInclude}
            />
            <Input
              accessibilityLabel="Files to exclude"
              autoCapitalize="none"
              autoCorrect={false}
              className="native:h-10 font-mono text-xs"
              placeholder="files to exclude"
              testID="porcelain-search-exclude"
              value={exclude}
              onChangeText={setExclude}
            />
          </View>
        ) : null}
      </View>

      {error === null ? null : (
        <View className="px-[16px] pb-[8px]">
          <ErrorNote message={error.message} testID="porcelain-search-error" />
        </View>
      )}

      {trimmed === '' ? (
        <EmptyNote
          body={
            contentMode
              ? 'Grep the whole repo — turn on .* for a regular expression, or ⋯ to narrow it to a folder.'
              : 'Fuzzy match on the path — “mobshell” finds apps/mobile/src/features/shell.'
          }
          testID="porcelain-search-idle"
          title="Search the repo"
        />
      ) : !found ? (
        <Text
          className="px-[16px] py-6 text-center text-sm text-muted-foreground"
          testID={searching ? 'porcelain-search-searching' : 'porcelain-search-empty'}
        >
          {searching
            ? 'Searching…'
            : contentMode
              ? `No matches for “${trimmed}”. Try different terms or filters.`
              : `No file matches “${trimmed}”.`}
        </Text>
      ) : contentMode && text.result !== undefined ? (
        <View className="min-h-0 flex-1">
          <ResultSummary
            files={text.result.files.length}
            matches={text.result.files.reduce((total, file) => total + file.matchCount, 0)}
            truncated={text.result.truncated}
          />
          <ContentResults
            bottomInset={bottomInset}
            caseSensitive={settled.caseSensitive}
            files={text.result.files}
            query={settled.query}
            regex={settled.regex}
            selectedPath={selectedPath}
            onOpenLine={onOpenFile}
          />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={surfaceContentStyle({ bottomInset, gap: 2 })}
          data={paths.results}
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

/**
 * What the daemon found, and whether it told us everything.
 *
 * `truncated` is not a detail: a capped result set that reads as complete is a search that
 * quietly lies about the repo.
 */
function ResultSummary({
  files,
  matches,
  truncated,
}: {
  files: number
  matches: number
  truncated: boolean
}): React.JSX.Element {
  return (
    <Text
      className="px-[16px] pb-1 text-[11px] text-muted-foreground"
      testID="porcelain-search-summary"
    >
      {matches} {matches === 1 ? 'result' : 'results'} in {files} {files === 1 ? 'file' : 'files'}
      {truncated ? ' · capped — narrow the search to see the rest' : ''}
    </Text>
  )
}

/** A two-character toggle sized for a thumb, in the field's trailing gutter. */
function OptionChip({
  accessibilityLabel,
  label,
  onPress,
  pressed,
  testID,
}: {
  accessibilityLabel: string
  label: string
  onPress: () => void
  pressed: boolean
  testID: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: pressed }}
      className={cn(
        'size-9 items-center justify-center rounded-lg active:bg-accent',
        pressed && 'bg-background shadow-sm shadow-black/5',
      )}
      hitSlop={2}
      testID={testID}
      onPress={onPress}
    >
      <Text
        className={cn(
          'font-mono text-[13px] font-semibold',
          pressed ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {label}
      </Text>
    </Pressable>
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
