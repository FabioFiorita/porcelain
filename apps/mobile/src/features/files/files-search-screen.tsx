import { ObserveInteractiveMarker } from 'expo-observe'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { DaemonGate } from '@/components/daemon-gate'
import { ScreenHeader } from '@/components/screen-header'
import { useSurfaceFocus } from '@/components/use-surface-focus'
import { useAccentColor } from '@/theme/use-accent-color'
import { SearchResults } from './search-results'
import { useDebouncedFileQuery } from './use-files'

/**
 * Files tab search face — dual-face like Board/History (re-tap to flip; no Done).
 * The field is the native `UISearchController` bar stacked under the header, so the
 * magnifier, clear button, Cancel and focus animation are iOS chrome rather than a
 * hand-drawn `TextInput`. It never claims focus on mount: flipping to this face shows
 * the results canvas, and the keyboard waits for a tap on the field.
 */
export function FilesSearchScreen(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedFileQuery(query)
  const accentColor = useAccentColor()
  useSurfaceFocus('search')

  return (
    <>
      <DaemonGate requires="repo">
        <Stack.SearchBar
          autoCapitalize="none"
          hideWhenScrolling={false}
          onCancelButtonPress={(): void => {
            setQuery('')
          }}
          onChangeText={(event): void => {
            setQuery(event.nativeEvent.text)
          }}
          placeholder="Search files"
          placement="stacked"
          tintColor={accentColor}
        />
        <View style={styles.results}>
          <SearchResults query={debouncedQuery} />
        </View>
      </DaemonGate>
      <ScreenHeader title="Search" />
      <ObserveInteractiveMarker />
    </>
  )
}

const styles = StyleSheet.create({
  results: {
    flex: 1,
    minHeight: 0,
  },
})
