import {
  Button,
  HStack,
  Image,
  LazyVStack,
  ScrollView,
  Spacer,
  Text,
  useNativeState,
  VStack,
} from '@expo/ui/swift-ui'
import {
  font,
  foregroundStyle,
  id,
  lineLimit,
  listRowBackground,
  listRowInsets,
  scrollPosition,
  scrollTargetLayout,
} from '@expo/ui/swift-ui/modifiers'
import { type Ref, useImperativeHandle } from 'react'

import type { DiffRow } from '@/features/changes/lib/diff-rows'
import { basename, formatStats } from '@/features/changes/lib/format'
import { statusSymbol } from '@/features/changes/lib/status'
import type { RowCanvasHandle, RowCanvasVisibleRange } from '@/lib/row-canvas/types'
import { statusTint, useDiffBackgrounds } from '@/theme/colors'
import { footnote, monospace, secondary } from '@/theme/modifiers'

const caption = font({ textStyle: 'caption' })
const headline = font({ textStyle: 'headline' })
const tightRow = listRowInsets({ bottom: 1, leading: 12, top: 1, trailing: 8 })

/**
 * The app's one diff renderer: a flat row array in a single virtualized `List`. Unified only,
 * no highlighting, long lines truncate — a per-line horizontal scroll view is a performance
 * trap, and the file screen is the escape hatch for a line you need to read whole.
 */
export function DiffRowsView({
  onOpenFile,
  onVisibleRange,
  rows,
  surfaceRef,
}: {
  onOpenFile?: (path: string) => void
  onVisibleRange?: (range: RowCanvasVisibleRange) => void
  rows: readonly DiffRow[]
  surfaceRef?: Ref<RowCanvasHandle>
}): React.JSX.Element {
  const backgrounds = useDiffBackgrounds()
  const activeRow = useNativeState<string | null>(null)

  useImperativeHandle(
    surfaceRef,
    (): RowCanvasHandle => ({
      scrollToRow: async (rowId: string): Promise<void> => {
        activeRow.set(rowId)
      },
      scrollToTop: async (): Promise<void> => {
        activeRow.set(rows[0]?.key ?? null)
      },
    }),
    [activeRow, rows],
  )

  function handleVisibleRow(rowId: string | null): void {
    if (rowId === null) return
    const index = rows.findIndex((row) => row.key === rowId)
    if (index === -1) return
    onVisibleRange?.({
      firstIndex: index,
      firstRowId: rowId,
      lastIndex: index,
      lastRowId: rowId,
      totalRows: rows.length,
    })
  }

  return (
    <ScrollView modifiers={[scrollPosition(activeRow, { onChange: handleVisibleRow })]}>
      <LazyVStack modifiers={[scrollTargetLayout()]}>
        {rows.map((row) => (
          <VStack key={row.key} modifiers={[id(row.key)]}>
            <DiffRowView backgrounds={backgrounds} onOpenFile={onOpenFile} row={row} />
          </VStack>
        ))}
      </LazyVStack>
    </ScrollView>
  )
}

function DiffRowView({
  backgrounds,
  onOpenFile,
  row,
}: {
  backgrounds: { add: string; del: string }
  onOpenFile?: (path: string) => void
  row: DiffRow
}): React.JSX.Element {
  switch (row.kind) {
    case 'layer':
      return <Text modifiers={[caption, secondary]}>{row.label.toUpperCase()}</Text>
    case 'file':
      return (
        <HStack spacing={8}>
          <Image
            modifiers={[foregroundStyle({ color: statusTint(row.status), type: 'color' })]}
            size={16}
            systemName={statusSymbol(row.status)}
          />
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[headline, lineLimit(1)]}>{basename(row.path)}</Text>
            <Text modifiers={[footnote, secondary, lineLimit(1)]}>
              {[row.path, formatStats(row.additions, row.deletions)]
                .filter((part) => part !== '')
                .join(' · ')}
            </Text>
          </VStack>
          <Spacer />
        </HStack>
      )
    case 'hunk':
      return <Text modifiers={[monospace, secondary, lineLimit(1)]}>{row.header}</Text>
    case 'line':
      return (
        <HStack
          modifiers={
            row.tone === 'context'
              ? [tightRow]
              : [tightRow, listRowBackground(backgrounds[row.tone])]
          }
          spacing={8}
        >
          <Text modifiers={[monospace, secondary]}>{row.gutter}</Text>
          <Text modifiers={[monospace, lineLimit(1)]}>{row.text}</Text>
          <Spacer />
        </HStack>
      )
    case 'notice':
      return <NoticeRow onOpenFile={onOpenFile} path={row.path} text={row.text} />
  }
}

function NoticeRow({
  onOpenFile,
  path,
  text,
}: {
  onOpenFile?: (path: string) => void
  path?: string
  text: string
}): React.JSX.Element {
  if (path === undefined || onOpenFile === undefined) {
    return <Text modifiers={[footnote, secondary]}>{text}</Text>
  }
  return <Button label={text} onPress={(): void => onOpenFile(path)} />
}
