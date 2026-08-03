import type { EntryItem } from '@/components/entry-rows'
import type { DirEntry } from '@/lib/daemon/procedures/files'

/**
 * The file tree, flattened. Children are whatever the daemon has already handed back for an open
 * folder — the tree reads one directory at a time, exactly as the renderer's `tree-node.tsx` does,
 * so a folder's item count only exists once it has been opened. Order is the daemon's; sorting
 * here would be a second opinion about a listing the other client already agrees on.
 */

export type FileTreeInput = {
  root: string
  entriesByPath: ReadonlyMap<string, readonly DirEntry[]>
  expanded: ReadonlySet<string>
}

export function fileTreeItems(input: FileTreeInput): EntryItem[] {
  const items: EntryItem[] = []
  appendChildren(items, input, input.root, 0)
  return items
}

function appendChildren(
  items: EntryItem[],
  input: FileTreeInput,
  parent: string,
  depth: number,
): void {
  for (const entry of input.entriesByPath.get(parent) ?? []) {
    const expanded = entry.kind === 'dir' && input.expanded.has(entry.path)
    items.push(treeItem(entry, depth, expanded, input.entriesByPath.get(entry.path)))
    if (expanded) appendChildren(items, input, entry.path, depth + 1)
  }
}

function treeItem(
  entry: DirEntry,
  depth: number,
  expanded: boolean,
  children: readonly DirEntry[] | undefined,
): EntryItem {
  const count = entry.kind === 'dir' && children !== undefined ? `${children.length}` : ''
  return {
    depth,
    dimmed: entry.hidden,
    expanded,
    key: entry.path,
    kind: entry.kind === 'dir' ? 'dir' : 'file',
    name: entry.name,
    path: entry.path,
    trailing: count === '' ? undefined : [{ text: count }],
  }
}

/** Every ancestor of a path inside the repo, root first — the chain a reveal has to open. */
export function ancestorPaths(root: string, path: string): string[] {
  if (!path.startsWith(`${root}/`)) return []
  const segments = path
    .slice(root.length + 1)
    .split('/')
    .filter((segment) => segment !== '')
  const ancestors: string[] = []
  let current = root
  for (const segment of segments.slice(0, -1)) {
    current = `${current}/${segment}`
    ancestors.push(current)
  }
  return ancestors
}
