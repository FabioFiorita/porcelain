import { ObserveInteractiveMarker } from 'expo-observe'
import { useState } from 'react'
import {
  Platform,
  StyleSheet,
  TextInput,
  type TextInputProps,
  useColorScheme,
  View,
} from 'react-native'

import { DaemonGate } from '@/components/daemon-gate'
import { ScreenHeader } from '@/components/screen-header'
import { useSurfaceFocus } from '@/components/use-surface-focus'
import { SearchResults } from './search-results'
import { useDebouncedFileQuery } from './use-files'

/**
 * Files tab search face — dual-face like Board/History (re-tap to flip; no Done).
 * Field is a fixed RN TextInput above the results FlatList. SwiftUI TextField as a
 * FlatList header collapses to zero height under ScreenHost measurement.
 */
export function FilesSearchScreen(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedFileQuery(query)
  const dark = useColorScheme() === 'dark'
  useSurfaceFocus('search')

  return (
    <>
      <DaemonGate requires="repo">
        <View style={styles.root}>
          <View style={styles.fieldWrap}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              clearButtonMode="while-editing"
              onChangeText={setQuery}
              placeholder="Search files"
              placeholderTextColor={dark ? '#8E8E93' : '#8E8E93'}
              returnKeyType="search"
              style={[styles.field, dark ? styles.fieldDark : styles.fieldLight]}
              value={query}
              {...platformFieldProps}
            />
          </View>
          <View style={styles.results}>
            <SearchResults query={debouncedQuery} />
          </View>
        </View>
      </DaemonGate>
      <ScreenHeader title="Search" />
      <ObserveInteractiveMarker />
    </>
  )
}

const platformFieldProps: Pick<TextInputProps, 'textContentType'> =
  Platform.OS === 'ios' ? { textContentType: 'none' } : {}

const styles = StyleSheet.create({
  field: {
    backgroundColor: 'rgba(120, 120, 128, 0.16)',
    borderRadius: 12,
    fontSize: 17,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fieldDark: {
    color: '#fff',
  },
  fieldLight: {
    color: '#000',
  },
  fieldWrap: {
    flexGrow: 0,
    flexShrink: 0,
    paddingBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  results: {
    flex: 1,
    minHeight: 0,
  },
  root: {
    flex: 1,
  },
})
