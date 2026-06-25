import type { SymbolLocation } from '@main/lsp'
import { FileTypeIcon } from '@renderer/components/viewer/file-icon'
import { useLspEnabledFor, useReferencesQuery } from '@renderer/hooks/use-lsp'
import { dirName, fileName, relativeTo } from '@renderer/lib/paths'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { Search } from 'lucide-react'

// The viewer's `references` tab: the REAL LSP "find all references" result for a
// symbol, grouped by file. Only ever opened from the LSP branch of the editor's
// context menu (heuristic text-search stays the `search` tab). Reference counts are
// small, so this is a plain scroll — no virtualization — but it borrows the
// explore/search reading idiom (header + count tag, file groups, hover rows).

/** One file's references: a header (path relative to the repo) over its rows. */
function FileGroup({
  path,
  locations,
  repoPath,
}: {
  path: string
  locations: SymbolLocation[]
  repoPath: string
}): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const name = fileName(path)
  const relative = relativeTo(repoPath, path)
  const dir = dirName(relative)

  // SymbolLocation.line is 0-based; tabs expect a 1-based line (see editor-source's
  // goToDefinition). Open the file at the reference's line.
  const open = (line: number): void => {
    openTab({ id: tabId('file', path), kind: 'file', title: name, path, line: line + 1 })
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 px-2 py-1">
        <FileTypeIcon name={name} className="size-3.5 shrink-0" />
        <span className="shrink-0 truncate text-sm-minus">{name}</span>
        {dir && (
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" dir="rtl">
            {dir}
          </span>
        )}
        <span className="ml-auto shrink-0 font-mono text-2xs text-muted-foreground tabular-nums">
          {locations.length}
        </span>
      </div>
      <div className="flex flex-col pb-1">
        {locations.map((loc) => (
          <button
            key={`${loc.line}:${loc.character}`}
            type="button"
            onClick={() => open(loc.line)}
            className="flex w-full items-baseline gap-2 px-2 py-px text-left font-mono text-xs text-muted-foreground hover:bg-(--hover-fill)"
          >
            <span className="w-9 shrink-0 select-none text-right text-2xs text-muted-foreground/50 tabular-nums">
              {loc.line + 1}
            </span>
            <span className="min-w-0 flex-1 overflow-hidden whitespace-pre">
              column {loc.character + 1}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Group references by their file path, preserving first-seen order. */
function groupByFile(
  references: SymbolLocation[],
): { path: string; locations: SymbolLocation[] }[] {
  const groups: { path: string; locations: SymbolLocation[] }[] = []
  const byPath = new Map<string, SymbolLocation[]>()
  for (const ref of references) {
    const existing = byPath.get(ref.path)
    if (existing) existing.push(ref)
    else {
      const locations = [ref]
      byPath.set(ref.path, locations)
      groups.push({ path: ref.path, locations })
    }
  }
  return groups
}

export function ReferencesView({
  path,
  line,
  character,
}: {
  path: string
  line: number
  character: number
}): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const enabled = useLspEnabledFor(path)
  const { references, isLoading } = useReferencesQuery(
    repo?.path,
    path,
    { line, character },
    enabled,
  )

  const groups = groupByFile(references)
  const total = references.length

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-3 py-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{fileName(path)}</span>
          <span className="flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-2xs font-normal text-muted-foreground">
            <Search className="size-3" />
            references · {total}
          </span>
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Finding references…</p>
        ) : total === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No references</p>
        ) : (
          <div className="flex flex-col">
            <p className="px-3 py-1 text-xs text-muted-foreground">
              {total} {total === 1 ? 'reference' : 'references'} in {groups.length}{' '}
              {groups.length === 1 ? 'file' : 'files'}
            </p>
            {groups.map((group) => (
              <FileGroup
                key={group.path}
                path={group.path}
                locations={group.locations}
                repoPath={repo?.path ?? ''}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
