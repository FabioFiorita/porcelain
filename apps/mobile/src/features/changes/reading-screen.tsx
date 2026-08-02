import { Button, List, Section, Text } from '@expo/ui/swift-ui'
import { listStyle } from '@expo/ui/swift-ui/modifiers'
import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useColorScheme } from 'react-native'

import { DaemonGate } from '@/components/daemon-gate'
import { HeaderToolbar } from '@/components/header-toolbar'
import { ScreenHost } from '@/components/screen-host'
import type { DiffSurfaceHandle } from '@/features/changes/components/diff-surface'
import { DiffSurface } from '@/features/changes/components/diff-surface'
import type { FilePickerFile } from '@/features/changes/components/file-picker-pane'
import { QueryNotice } from '@/features/changes/components/query-notice'
import { useChangesPaneStore } from '@/features/changes/data/pane-store'
import { useDiffReading, useScopeFlow } from '@/features/changes/data/queries'
import {
  CANVAS_FILE_LINES,
  type DiffRow,
  isLargeChange,
  readingRows,
  totalStats,
} from '@/features/changes/lib/diff-rows'
import { formatStats } from '@/features/changes/lib/format'
import { parseScope, scopeParams } from '@/features/changes/lib/scope'
import { useDiffTokenizer } from '@/features/changes/lib/use-diff-tokenizer'
import type { DiffReadingScope } from '@/lib/daemon/procedures/changes'
import { isRowCanvasAvailable } from '@/lib/row-canvas/row-canvas'
import type { RowCanvasVisibleRange } from '@/lib/row-canvas/types'
import { footnote, secondary } from '@/theme/modifiers'

/**
 * The whole change as one scrolling document, in flow order. Reached only by an explicit tap:
 * `diffReading` can carry ~200 files of hunks in one response, so it is never prefetched and
 * never polled, and a change the flow totals say is large asks first.
 */
export function ReadingScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ scope?: string; hash?: string }>()
  const scope = parseScope(params.scope, params.hash)

  return (
    <>
      <DaemonGate requires="repo">
        <Reading scope={scope} />
      </DaemonGate>
      <HeaderToolbar companion={{ href: '/actions', icon: 'bolt', label: 'Actions' }} />
    </>
  )
}

function Reading({ scope }: { scope: DiffReadingScope }): React.JSX.Element {
  const [confirmed, setConfirmed] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const surfaceRef = useRef<DiffSurfaceHandle>(null)
  const paneOwner = useRef(Symbol('changes-reader'))
  const clearPane = useChangesPaneStore((state) => state.clear)
  const publishPane = useChangesPaneStore((state) => state.publish)
  const tokenizer = useDiffTokenizer(useColorScheme())
  const flow = useScopeFlow(scope)
  const totals = totalStats(flow.data ?? [])
  const large = flow.data !== undefined && isLargeChange(totals)
  const reading = useDiffReading(scope, flow.data !== undefined && (!large || confirmed))
  // Built once per response: every re-render otherwise re-runs the word diff over the whole
  // change and re-serializes it, on the JS thread, for a document the native side already has.
  const rows = useMemo(
    (): DiffRow[] =>
      reading.data === undefined
        ? []
        : readingRows(reading.data, isRowCanvasAvailable() ? CANVAS_FILE_LINES : undefined),
    [reading.data],
  )

  const files = useMemo(
    (): FilePickerFile[] =>
      reading.data?.groups.flatMap((group) =>
        group.files.map((file) => ({
          additions: file.additions,
          deletions: file.deletions,
          path: file.path,
          status: file.status,
        })),
      ) ?? [],
    [reading.data],
  )
  const renderedPaths = useMemo(
    (): ReadonlySet<string> =>
      new Set(rows.flatMap((row) => (row.kind === 'file' ? [row.path] : []))),
    [rows],
  )
  const fileByRowId = useMemo((): Map<string, string> => {
    const paths = new Map<string, string>()
    let currentPath: string | null = null
    for (const row of rows) {
      if (row.kind === 'file') currentPath = row.path
      if (currentPath !== null) paths.set(row.key, currentPath)
    }
    return paths
  }, [rows])
  const handleVisibleRange = useCallback(
    (range: RowCanvasVisibleRange): void => {
      const path = fileByRowId.get(range.firstRowId)
      if (path !== undefined) setSelectedPath(path)
    },
    [fileByRowId],
  )
  const selectFile = useCallback(
    (path: string): void => {
      setSelectedPath(path)
      if (renderedPaths.has(path)) {
        surfaceRef.current?.scrollToRow(`file:${path}`)
        return
      }
      router.push({ params: { ...scopeParams(scope), path }, pathname: '/file' })
    },
    [renderedPaths, scope],
  )

  useEffect(() => {
    setSelectedPath(files[0]?.path ?? null)
  }, [files])
  useEffect(() => {
    if (reading.data === undefined) {
      clearPane(paneOwner.current)
      return
    }
    publishPane({
      files,
      onSelect: selectFile,
      owner: paneOwner.current,
      selectedPath,
    })
    return (): void => clearPane(paneOwner.current)
  }, [clearPane, files, publishPane, reading.data, selectFile, selectedPath])

  const openFile = useCallback(
    (path: string): void => {
      router.push({ params: { ...scopeParams(scope), path }, pathname: '/file' })
    },
    [scope],
  )

  if (large && !confirmed) {
    return (
      <ScreenHost>
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section title="Large change">
            <Text>{`${totals.files} files · ${formatStats(totals.additions, totals.deletions)}`}</Text>
            <Text modifiers={[footnote, secondary]}>
              Reading this inline pulls every file's diff in one response. Opening files one at a
              time is faster on a phone.
            </Text>
            <Button label="Read file by file" onPress={(): void => router.back()} />
            <Button label="Load anyway" onPress={(): void => setConfirmed(true)} />
          </Section>
        </List>
      </ScreenHost>
    )
  }

  if (reading.data === undefined) {
    return (
      <ScreenHost>
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section>
            <QueryNotice
              description="Reading the whole change from the daemon."
              error={reading.error ?? flow.error}
              isPending={reading.isPending}
              onRetry={(): void => {
                reading.refetch()
              }}
              symbol="text.alignleft"
              title="Nothing to read"
            />
          </Section>
        </List>
      </ScreenHost>
    )
  }

  return (
    <DiffSurface
      contentKey={`reading:${scope.type}:${scope.type === 'commit' ? scope.hash : 'working'}`}
      onOpenFile={openFile}
      onVisibleRange={handleVisibleRange}
      rows={rows}
      surfaceRef={surfaceRef}
      tokenizer={tokenizer}
    />
  )
}
