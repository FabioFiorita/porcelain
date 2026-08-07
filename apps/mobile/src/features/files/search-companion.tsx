import { Pressable, ScrollView, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { IconAction, PanelLabel } from '@/components/panel-chrome'
import { useShellStore } from '@/features/shell/shell-store'
import { useIsTablet } from '@/features/shell/use-app-window'

import { pathTestId } from './file-paths'
import { useFilesStore } from './files-store'

/**
 * The Search companion — "Recent searches", the same roster the web rail carries.
 *
 * Search shares Files' viewer but not its companion: pinned paths and repo notes answer "where
 * do I work", and the question you have while searching is "what did I just look for".
 *
 * Client-only and unpersisted, like the desktop's: a search session is ephemeral, and a query
 * from a previous cold start is rarely the one you want back. Reads nothing from the daemon,
 * so it needs no `active` flag.
 */
export function SearchCompanion(): React.JSX.Element {
  const recent = useFilesStore((state) => state.recentSearches)
  const setQuery = useFilesStore((state) => state.setQuery)
  const forgetSearch = useFilesStore((state) => state.forgetSearch)
  const closeSheet = useShellStore((state) => state.closeSheet)
  const isTablet = useIsTablet()

  // The tablet's inspector sits beside the results, so re-running a query leaves it open. The
  // phone's sheet covers the field it just filled, so it gets out of the way.
  const run = (query: string): void => {
    setQuery(query)
    if (!isTablet) closeSheet()
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-2 px-4 pb-8 pt-3"
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      testID="porcelain-search-companion"
    >
      <PanelLabel>{recent.length > 0 ? `Recent · ${recent.length}` : 'Recent'}</PanelLabel>

      {recent.length === 0 ? (
        <Text className="text-[11px] leading-4 text-muted-foreground">
          A search that finds something lands here. Tap one to run it again.
        </Text>
      ) : (
        <View className="gap-1">
          {recent.map((query) => (
            <View key={query} className="flex-row items-center gap-1">
              <Pressable
                accessibilityLabel={`Search again for ${query}`}
                accessibilityRole="button"
                className="min-h-10 min-w-0 flex-1 flex-row items-center gap-2 rounded-xl px-2 py-1.5 active:bg-accent"
                // The query is the row's identity here, the way a path is in the pinned list.
                testID={pathTestId('porcelain-search-recent', query)}
                onPress={() => {
                  run(query)
                }}
              >
                <ChromeGlyph name="search" size={14} />
                <Text
                  className="min-w-0 flex-1 font-mono text-xs text-foreground"
                  numberOfLines={1}
                >
                  {query}
                </Text>
              </Pressable>
              <IconAction
                accessibilityLabel={`Forget the search for ${query}`}
                glyph="close"
                testID={pathTestId('porcelain-search-forget', query)}
                onPress={() => {
                  forgetSearch(query)
                }}
              />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}
