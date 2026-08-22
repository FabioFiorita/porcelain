import { Pressable, ScrollView, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { IconAction, PanelLabel } from '@/components/panel-chrome'
import { useDismissSheet } from '@/features/shell/shell-sheets'
import { pathTestId } from '@/lib/path-identities'

import { useSearchStore } from './search-store'

/**
 * The Search companion — "Recent searches", the same roster the web rail carries.
 *
 * On a phone this is the bolt sheet's whole content. On a tablet there is no companion column
 * any more, so `RecentSearches` is mounted by the Search panel itself, in the space an empty
 * query leaves — which is the moment the list is worth reading and the only moment it is not
 * competing with results.
 *
 * Client-only and unpersisted, like the desktop's: a search session is ephemeral, and a query
 * from a previous cold start is rarely the one you want back.
 */
export function SearchCompanion(): React.JSX.Element {
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-2 px-4 pb-8 pt-3"
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      testID="porcelain-search-companion"
    >
      <RecentSearches />
    </ScrollView>
  )
}

/**
 * The roster itself. Running one dismisses the host if it is covering something — the phone's
 * bolt sheet — and stays put in a panel, where the results appear beside the list that asked
 * for them. `useDismissSheet` is inert outside a sheet, so this is one code path.
 */
export function RecentSearches(): React.JSX.Element | null {
  const recent = useSearchStore((state) => state.recentSearches)
  const setQuery = useSearchStore((state) => state.setQuery)
  const forgetSearch = useSearchStore((state) => state.forgetSearch)
  const closeSheet = useDismissSheet()

  const run = (query: string): void => {
    setQuery(query)
    closeSheet()
  }

  return (
    <View className="gap-2" testID="porcelain-search-recent">
      <PanelLabel>
        {recent.length > 0 ? `Recent searches · ${recent.length}` : 'Recent searches'}
      </PanelLabel>

      {recent.length === 0 ? (
        <Text className="text-2xs leading-4 text-muted-foreground">
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
    </View>
  )
}
