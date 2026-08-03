import { List, Section, Text, TextField, useNativeState } from '@expo/ui/swift-ui'
import { listStyle } from '@expo/ui/swift-ui/modifiers'
import { ObserveInteractiveMarker } from 'expo-observe'
import { useState } from 'react'

import { DaemonGate } from '@/components/daemon-gate'
import { ScreenHeader } from '@/components/screen-header'
import { ScreenHost } from '@/components/screen-host'
import { useSurfaceFocus } from '@/components/use-surface-focus'
import { secondary } from '@/theme/modifiers'
import { SearchResults } from './search-results'
import { useDebouncedFileQuery } from './use-files'

/**
 * Files tab search face. Re-tap Files → this face mounts with `autoFocus` so the keyboard
 * is up immediately. No nav-bar search field — that fought title + workspace for space.
 */
export function FilesSearchScreen(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const nativeQuery = useNativeState('')
  const debouncedQuery = useDebouncedFileQuery(query)
  useSurfaceFocus('files')

  return (
    <>
      <DaemonGate requires="repo">
        <ScreenHost>
          <List modifiers={[listStyle('insetGrouped')]}>
            <Section>
              <TextField
                autoFocus
                onTextChange={(value: string): void => {
                  setQuery(value)
                }}
                placeholder="Search files"
                text={nativeQuery}
              />
            </Section>
            {debouncedQuery.trim() === '' ? (
              <Section>
                <Text modifiers={[secondary]}>
                  Filename search in this repository. Re-tap Search to return to Files.
                </Text>
              </Section>
            ) : null}
          </List>
          {debouncedQuery.trim() === '' ? null : <SearchResults query={debouncedQuery} />}
        </ScreenHost>
      </DaemonGate>
      <ScreenHeader title="Search" />
      <ObserveInteractiveMarker />
    </>
  )
}
