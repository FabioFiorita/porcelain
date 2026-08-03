import type { EntryItem, EntrySpan } from '@/components/entry-rows'
import { totalStats } from '@/features/changes/lib/diff-rows'
import { basename, dirname, formatStats, stagingLabel } from '@/features/changes/lib/format'
import { statusSymbol } from '@/features/changes/lib/status'
import type { FlowFile, FlowGroup } from '@/lib/daemon/procedures/changes'
import { statusTint } from '@/theme/colors'

/**
 * Changed files as list rows, grouped by review-flow layer in the daemon's order. The layer is the
 * story the Changes tab tells, so it stays the grouping — a folder tree of the same files would
 * lose the one thing this list knows that a file browser does not. Layer order and file order come
 * from the daemon and are never re-sorted here.
 *
 * The leading glyph is git status rather than file type: on this surface what happened to a file
 * is the fact worth a column, and the extension is right there in the name.
 */

export function flowEntryItems(
  groups: readonly FlowGroup[],
  reviewedPaths?: readonly string[],
): EntryItem[] {
  const reviewed = new Set(reviewedPaths ?? [])
  const items: EntryItem[] = []

  for (const group of groups) {
    items.push({
      key: `layer:${group.layer}`,
      kind: 'section',
      title: group.layer,
      trailing: layerTrailing(group),
    })
    for (const file of group.files) {
      items.push(fileItem(file, reviewed.has(file.path)))
    }
  }

  return items
}

function layerTrailing(group: FlowGroup): EntrySpan[] {
  const totals = totalStats([group])
  return [
    { text: `${totals.files} file${totals.files === 1 ? '' : 's'}` },
    { text: formatStats(totals.additions, totals.deletions) },
  ].filter((span) => span.text !== '')
}

function fileItem(file: FlowFile, reviewed: boolean): EntryItem {
  return {
    depth: 0,
    key: file.path,
    kind: 'file',
    label: spokenFile(file, reviewed),
    name: basename(file.path),
    path: file.path,
    symbol: { name: statusSymbol(file.status), tint: statusTint(file.status) },
    trailing: fileTrailing(file, reviewed),
  }
}

function fileTrailing(file: FlowFile, reviewed: boolean): EntrySpan[] {
  const spans: EntrySpan[] = [{ text: dirname(file.path) }]
  if (file.additions !== undefined && file.additions > 0) {
    spans.push({ text: `+${file.additions}`, tint: statusTint('added') })
  }
  if (file.deletions !== undefined && file.deletions > 0) {
    spans.push({ text: `−${file.deletions}`, tint: statusTint('deleted') })
  }
  spans.push({ text: stagingLabel(file) })
  // The reviewed tick is the same green the diff paints an addition with — one "this is settled"
  // colour across the surfaces.
  if (reviewed) spans.push({ text: '✓', tint: statusTint('added') })
  return spans.filter((span) => span.text !== '')
}

function spokenFile(file: FlowFile, reviewed: boolean): string {
  return [
    basename(file.path),
    file.status ?? 'changed',
    dirname(file.path),
    formatStats(file.additions, file.deletions),
    stagingLabel(file),
    reviewed ? 'reviewed' : '',
  ]
    .filter((part) => part !== '')
    .join(', ')
}
