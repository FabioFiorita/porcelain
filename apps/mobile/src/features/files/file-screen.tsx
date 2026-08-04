import { RNHostView, Text as SwiftText, VStack } from '@expo/ui/swift-ui'
import { font, frame, padding } from '@expo/ui/swift-ui/modifiers'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { Image, StyleSheet, Text, useColorScheme, View } from 'react-native'

import { DaemonGate } from '@/components/daemon-gate'
import { HeaderToolbar } from '@/components/header-toolbar'
import { ScreenHost } from '@/components/screen-host'
import { toolbarIcon } from '@/components/toolbar-icon'
import type { FileView } from '@/lib/daemon/procedures/files'
import { useActiveRepo } from '@/lib/daemon/repo'
import { setPreference, usePreferences } from '@/lib/preferences'
import { DocumentWebView } from './document-webview'
import { isHtmlPath, isMarkdownPath } from './file-kind'
import { absoluteRepoPath, basename, routeSegments } from './file-paths'
import { FilesLoading, FilesQueryState, FileViewState } from './files-empty-states'
import { markdownToHtml, wrapMarkdownReaderHtml } from './markdown-to-html'
import { SourceSurface } from './source-surface'
import { useFilesFocused, useFileView, useInvalidateFiles, usePreviewHtml } from './use-files'

const MAX_TEXT_BYTES = 256 * 1024
const MAX_TEXT_LINES = 5_000

export function FileScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ path?: string | string[] }>()
  const relativePath = routeSegments(params.path).join('/')
  const title = basename(relativePath) || 'File'
  const preferences = usePreferences()
  const markdown = isMarkdownPath(relativePath)
  const html = isHtmlPath(relativePath)

  return (
    <>
      <Stack.Screen options={{ title }} />
      <DaemonGate requires="repo">
        <FileBody relativePath={relativePath} />
      </DaemonGate>
      <HeaderToolbar
        menu={
          markdown || html ? (
            <Stack.Toolbar.Menu accessibilityLabel="View mode" icon={toolbarIcon('more')}>
              {markdown ? (
                <>
                  <Stack.Toolbar.MenuAction
                    icon="doc.richtext"
                    isOn={preferences.markdown === 'reader'}
                    onPress={(): void => setPreference('markdown', 'reader')}
                  >
                    Reader
                  </Stack.Toolbar.MenuAction>
                  <Stack.Toolbar.MenuAction
                    icon="chevron.left.forwardslash.chevron.right"
                    isOn={preferences.markdown === 'source'}
                    onPress={(): void => setPreference('markdown', 'source')}
                  >
                    Source
                  </Stack.Toolbar.MenuAction>
                </>
              ) : null}
              {html ? (
                <>
                  <Stack.Toolbar.MenuAction
                    icon="safari"
                    isOn={preferences.html === 'preview'}
                    onPress={(): void => setPreference('html', 'preview')}
                  >
                    Preview
                  </Stack.Toolbar.MenuAction>
                  <Stack.Toolbar.MenuAction
                    icon="chevron.left.forwardslash.chevron.right"
                    isOn={preferences.html === 'source'}
                    onPress={(): void => setPreference('html', 'source')}
                  >
                    Source
                  </Stack.Toolbar.MenuAction>
                </>
              ) : null}
            </Stack.Toolbar.Menu>
          ) : undefined
        }
      />
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

  if (query.data.type === 'text') {
    return <TextFileView absolutePath={path} relativePath={relativePath} view={query.data} />
  }
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

function TextFileView({
  absolutePath,
  relativePath,
  view,
}: {
  absolutePath: string
  relativePath: string
  view: Extract<FileView, { type: 'text' }>
}): React.JSX.Element {
  const preferences = usePreferences()
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const clipped = clipText(view.content)
  const markdown = isMarkdownPath(relativePath)
  const html = isHtmlPath(relativePath)
  const reader = markdown && preferences.markdown === 'reader'
  const preview = html && preferences.html === 'preview'
  const previewQuery = usePreviewHtml(absolutePath, preview)

  if (reader) {
    const body = markdownToHtml(clipped.content)
    const document = wrapMarkdownReaderHtml(body, scheme)
    return (
      <View style={styles.fill}>
        <DocumentWebView html={document} />
        {clipped.truncated ? <TruncationNotice lines={clipped.lines} /> : null}
      </View>
    )
  }

  if (preview) {
    if (previewQuery.error !== null && previewQuery.error !== undefined) {
      return (
        <FilesQueryState
          description="Switch to Source to read the raw file."
          error={previewQuery.error}
          onRetry={(): void => {
            previewQuery.refetch()
          }}
          title="Could not preview HTML"
        />
      )
    }
    if (previewQuery.data === undefined) {
      return <FilesLoading description="Building the HTML preview." />
    }
    if (previewQuery.data === null) {
      return (
        <ScreenHost>
          <VStack
            alignment="center"
            modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity }), padding({ all: 24 })]}
            spacing={10}
          >
            <SwiftText modifiers={[font({ textStyle: 'title3', weight: 'semibold' })]}>
              Preview unavailable
            </SwiftText>
            <SwiftText modifiers={[font({ textStyle: 'body' })]}>
              This HTML file is missing or too large to preview. Switch to Source for the raw file.
            </SwiftText>
          </VStack>
        </ScreenHost>
      )
    }
    // Native WebView fills the screen the same way the terminal does — no SwiftUI Host.
    return (
      <View style={styles.fill}>
        <DocumentWebView html={previewQuery.data} />
      </View>
    )
  }

  // Source sits on the row canvas like a diff — not inside a SwiftUI Host.
  return (
    <View style={styles.fill}>
      <SourceSurface
        content={clipped.content}
        contentKey={`${absolutePath}:${clipped.content.length}:${clipped.lines}`}
        path={relativePath}
      />
      {clipped.truncated ? <TruncationNotice lines={clipped.lines} /> : null}
    </View>
  )
}

function TruncationNotice({ lines }: { lines: number }): React.JSX.Element {
  return (
    <Text style={styles.truncation}>
      {`Showing the first ${lines} lines of this file — open it on the desktop for the rest.`}
    </Text>
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
  fill: {
    flex: 1,
  },
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
  truncation: {
    color: '#8E8E93',
    fontSize: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
})
