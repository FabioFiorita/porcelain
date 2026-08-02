import { RNHostView, ScrollView, Text as SwiftText, VStack } from '@expo/ui/swift-ui'
import { font, frame, padding, textSelection } from '@expo/ui/swift-ui/modifiers'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { Image, StyleSheet, View } from 'react-native'

import { DaemonGate } from '@/components/daemon-gate'
import { HeaderToolbar } from '@/components/header-toolbar'
import { ScreenHost } from '@/components/screen-host'
import type { FileView } from '@/lib/daemon/procedures/files'
import { useActiveRepo } from '@/lib/daemon/repo'
import { absoluteRepoPath, basename, routeSegments } from './file-paths'
import { FilesLoading, FilesQueryState, FileViewState } from './files-empty-states'
import { useFilesFocused, useFileView, useInvalidateFiles } from './use-files'

const MAX_TEXT_BYTES = 256 * 1024
const MAX_TEXT_LINES = 5_000

export function FileScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ path?: string | string[] }>()
  const relativePath = routeSegments(params.path).join('/')
  const title = basename(relativePath) || 'File'

  return (
    <>
      <Stack.Screen options={{ title }} />
      <DaemonGate requires="repo">
        <FileBody relativePath={relativePath} />
      </DaemonGate>
      <HeaderToolbar />
    </>
  )
}

function FileBody({ relativePath }: { relativePath: string }): React.JSX.Element {
  const repo = useActiveRepo()
  const focused = useFilesFocused()
  const invalidateFiles = useInvalidateFiles()
  const path = repo === null ? '' : absoluteRepoPath(repo.path, relativePath)
  const query = useFileView(path, repo !== null && focused)

  if (repo === null) return <FilesLoading />
  if (query.data === undefined) {
    if (query.error !== null && query.error !== undefined) {
      return (
        <FilesQueryState
          description="The file body was not loaded."
          error={query.error}
          onRetry={(): void => {
            query.refetch()
          }}
          title="Could not read this file"
        />
      )
    }
    return <FilesLoading description="Reading the file from the daemon." />
  }

  if (query.data.type === 'text') return <TextFileView view={query.data} />
  if (query.data.type === 'image') return <ImageFileView view={query.data} />

  return (
    <FileViewState
      onBack={(): void => {
        invalidateFiles()
        router.back()
      }}
      view={query.data}
    />
  )
}

function TextFileView({ view }: { view: Extract<FileView, { type: 'text' }> }): React.JSX.Element {
  const clipped = clipText(view.content)

  return (
    <ScreenHost>
      <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]} spacing={0}>
        <ScrollView
          modifiers={[
            frame({ maxWidth: Infinity, maxHeight: Infinity }),
            padding({ horizontal: 16, vertical: 12 }),
          ]}
        >
          <SwiftText
            modifiers={[
              font({ design: 'monospaced', textStyle: 'body' }),
              frame({ maxWidth: Infinity, alignment: 'leading' }),
              textSelection(true),
            ]}
          >
            {clipped.content}
          </SwiftText>
        </ScrollView>
        {clipped.truncated ? (
          <SwiftText
            modifiers={[font({ textStyle: 'footnote' }), padding({ horizontal: 16, vertical: 10 })]}
          >
            {`Showing the first ${clipped.lines} lines of this file — open it on the desktop for the rest.`}
          </SwiftText>
        ) : null}
      </VStack>
    </ScreenHost>
  )
}

function ImageFileView({
  view,
}: {
  view: Extract<FileView, { type: 'image' }>
}): React.JSX.Element {
  return (
    <ScreenHost>
      <RNHostView>
        <View style={styles.imageBackground}>
          <Image resizeMode="contain" source={{ uri: view.dataUrl }} style={styles.image} />
        </View>
      </RNHostView>
    </ScreenHost>
  )
}

function clipText(content: string): { content: string; lines: number; truncated: boolean } {
  const sourceLines = content.split('\n')
  let result = sourceLines.slice(0, MAX_TEXT_LINES).join('\n')
  let truncated = sourceLines.length > MAX_TEXT_LINES

  if (byteLength(result) > MAX_TEXT_BYTES) {
    let low = 0
    let high = result.length
    while (low < high) {
      const middle = Math.ceil((low + high) / 2)
      if (byteLength(result.slice(0, middle)) <= MAX_TEXT_BYTES) low = middle
      else high = middle - 1
    }
    result = result.slice(0, low)
    truncated = true
  }

  return { content: result, lines: result.split('\n').length, truncated }
}

function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).byteLength
  return value.length
}

const styles = StyleSheet.create({
  image: {
    height: '100%',
    width: '100%',
  },
  imageBackground: {
    alignItems: 'center',
    backgroundColor: '#151515',
    flex: 1,
    justifyContent: 'center',
  },
})
