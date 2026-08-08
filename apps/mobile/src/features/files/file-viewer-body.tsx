import { fileName } from '@porcelain/client-runtime/paths'
import { useEffect, useRef } from 'react'
import { type FlatList, Image, Text, View } from 'react-native'

import { EmptyNote, ErrorNote } from '@/components/panel-chrome'
import { SurfaceList } from '@/components/surface-scroll'
import type { FileView } from '@/lib/daemon/procedures/files'

import { pathTestId } from './file-paths'
import { previewDocument } from './preview-document'
import { PreviewView } from './preview-view'
import { SourceLine } from './source-lines'
import { describeBytes, focusRowIndex, type SourceRow } from './source-rows'

/**
 * The preview half of an HTML file. The daemon answers `null` when it declines to prepare the
 * page — missing, empty, or past the read cap — which is a state, not a failure, and the way
 * out of it is the Source toggle that is already on screen.
 */
export function HtmlPreviewBody({
  error,
  html,
  isLoading,
}: {
  error: Error | null
  html: string | null | undefined
  isLoading: boolean
}): React.JSX.Element {
  if (error !== null) {
    return (
      <View className="p-4">
        <ErrorNote message={error.message} testID="porcelain-files-preview-error" />
      </View>
    )
  }
  if (html === undefined && isLoading) {
    return (
      <Text className="p-4 text-sm text-muted-foreground" testID="porcelain-files-preview-loading">
        Preparing preview…
      </Text>
    )
  }
  if (html === null || html === undefined) {
    return (
      <EmptyNote
        body="The daemon could not prepare this page — it may be empty or past the read limit. Switch to Source for the raw file."
        testID="porcelain-files-preview-unavailable"
        title="No preview"
      />
    )
  }
  return <PreviewView document={previewDocument(html)} testID="porcelain-files-preview" />
}

/**
 * The source face, and every state a file can be in instead of one: a read that failed, a path
 * the daemon no longer has, an image, bytes, or something past the read cap.
 */
export function FileViewerBody({
  ctx,
  error,
  filePath,
  isLoading,
  line,
  rows,
  view,
}: {
  ctx: React.ComponentProps<typeof SourceLine>['ctx']
  error: Error | null
  filePath: string
  isLoading: boolean
  /** 1-based line the caller wants on screen, or undefined to open at the top. */
  line: number | undefined
  rows: SourceRow[]
  view: FileView | undefined
}): React.JSX.Element {
  const listRef = useRef<FlatList<SourceRow>>(null)
  // Hooks run before the early returns below, so the ref stays honest about which line has
  // already been jumped to when the file's contents arrive a beat after the route does.
  const jumped = useRef<string | null>(null)
  const target = focusRowIndex(line, rows.length)

  useEffect(() => {
    const key = `${filePath}:${String(target)}`
    if (target === null || jumped.current === key) return
    jumped.current = key
    // The list is measured, not laid out from a known row height, so the first frame after
    // mount has no offset for a row deep in the file; `onScrollToIndexFailed` finishes the job.
    listRef.current?.scrollToIndex({ animated: false, index: target, viewPosition: 0.3 })
  }, [filePath, target])

  if (error !== null) {
    return (
      <View className="p-4">
        <ErrorNote message={error.message} testID="porcelain-files-viewer-error" />
      </View>
    )
  }
  if (view === undefined && isLoading) {
    return (
      <Text className="p-4 text-sm text-muted-foreground" testID="porcelain-files-viewer-loading">
        Loading…
      </Text>
    )
  }
  if (view === undefined) {
    return (
      <EmptyNote
        body="The daemon returned nothing for this path."
        testID="porcelain-files-viewer-unavailable"
        title="Nothing to show"
      />
    )
  }
  if (view.type === 'not-found') {
    return (
      <EmptyNote
        body="It was deleted or moved on the host since this list was read."
        testID="porcelain-files-viewer-missing"
        title="This file no longer exists"
      />
    )
  }
  if (view.type === 'image') {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Image
          accessibilityLabel={fileName(filePath)}
          className="h-4/5 w-full"
          resizeMode="contain"
          source={{ uri: view.dataUrl }}
          testID="porcelain-files-viewer-image"
        />
      </View>
    )
  }
  if (view.type === 'binary') {
    return (
      <EmptyNote
        body={`${describeBytes(view.size)} of binary content — Porcelain doesn’t render bytes.`}
        testID="porcelain-files-viewer-binary"
        title="Binary file"
      />
    )
  }
  if (view.type === 'too-large') {
    return (
      <EmptyNote
        body={`${describeBytes(view.size)} is past the read limit — open this one on the host.`}
        testID="porcelain-files-viewer-too-large"
        title="File too large to preview"
      />
    )
  }
  if (rows.length === 0) {
    return (
      <EmptyNote
        body="Nothing has been written to it yet."
        testID="porcelain-files-viewer-empty"
        title="Empty file"
      />
    )
  }
  return (
    <SurfaceList
      ref={listRef}
      data={rows}
      edgeToEdge
      // Lines wrap to variable heights, so no getItemLayout: the window is measured. These
      // batch sizes keep a thousand-line file scrolling without blocking the JS thread.
      initialNumToRender={40}
      keyExtractor={(row) => row.key}
      maxToRenderPerBatch={40}
      renderItem={({ item }) => <SourceLine ctx={ctx} row={item} />}
      testID={pathTestId('porcelain-files-source', filePath)}
      windowSize={9}
      // A hit past the first window has no measured offset yet. Land on the estimate, which
      // renders the rows in between, then ask once more for the exact row. One retry only:
      // a loop here would fight the user's own scrolling.
      onScrollToIndexFailed={(info) => {
        listRef.current?.scrollToOffset({
          animated: false,
          offset: info.averageItemLength * info.index,
        })
        setTimeout(() => {
          listRef.current?.scrollToIndex({
            animated: false,
            index: Math.min(info.index, rows.length - 1),
            viewPosition: 0.3,
          })
        }, 120)
      }}
    />
  )
}
