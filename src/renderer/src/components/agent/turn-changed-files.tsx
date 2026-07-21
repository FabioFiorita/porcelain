import type { FlowGroup } from '@backend/flow'
import { Button } from '@renderer/components/ui/button'
import {
  buildChangedFileEntries,
  buildPathTree,
  type PathTreeNode,
  sumChangedStats,
} from '@renderer/lib/agent-touched-files'
import { openChanges } from '@renderer/lib/surface-handoffs'
import { cn } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { ChevronRight, File, Folder } from 'lucide-react'
import { useMemo, useState } from 'react'

/**
 * Connected preview: T3-style changed-files tree under an assistant turn.
 * Deep review always hands off to Changes (canonical home) — no chat Diff panel.
 */
export function TurnChangedFiles({
  writePaths,
  groups,
}: {
  writePaths: readonly string[]
  /** Working-tree flow groups (for +/− when paths are still dirty). */
  groups: FlowGroup[] | undefined
}): React.JSX.Element | null {
  const repoPath = useRepoStore((s) => s.repo?.path ?? null)
  const [collapsed, setCollapsed] = useState(false)

  const entries = useMemo(() => {
    const stats = new Map<string, { additions?: number; deletions?: number }>()
    for (const g of groups ?? []) {
      for (const f of g.files) {
        stats.set(f.path, { additions: f.additions, deletions: f.deletions })
      }
    }
    return buildChangedFileEntries(writePaths, repoPath, stats)
  }, [writePaths, groups, repoPath])

  const tree = useMemo(() => buildPathTree(entries), [entries])
  const totals = useMemo(() => sumChangedStats(entries), [entries])

  if (entries.length === 0) return null

  const openAll = (): void => {
    openChanges({ continuousReview: true })
  }

  return (
    <div className="rounded-xl border bg-card/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs text-foreground"
        >
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform',
              !collapsed && 'rotate-90',
            )}
          />
          <span className="font-medium">
            Changed files ({entries.length})
            {totals.hasStats && (
              <span className="ml-1.5 font-mono font-normal text-muted-foreground">
                <span className="text-diff-add-emphasis">+{totals.additions}</span>
                <span className="mx-0.5 text-muted-foreground/50">·</span>
                <span className="text-diff-del-emphasis">−{totals.deletions}</span>
              </span>
            )}
          </span>
        </button>
        <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={openAll}>
          View diff
        </Button>
      </div>
      {!collapsed && (
        <ul className="mt-2 flex flex-col gap-0.5 border-t border-border/50 pt-2">
          {tree.map((node) => (
            <TreeNodeRow key={node.path} node={node} depth={0} />
          ))}
        </ul>
      )}
    </div>
  )
}

function TreeNodeRow({ node, depth }: { node: PathTreeNode; depth: number }): React.JSX.Element {
  const [open, setOpen] = useState(true)
  const pad = { paddingLeft: `${depth * 12}px` }

  if (node.kind === 'dir') {
    return (
      <li className="flex flex-col gap-0.5">
        <button
          type="button"
          style={pad}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        >
          <ChevronRight
            className={cn('size-3 shrink-0 transition-transform', open && 'rotate-90')}
          />
          <Folder className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate font-mono">{node.name}</span>
          <StatChips additions={node.additions} deletions={node.deletions} />
        </button>
        {open &&
          (node.children ?? []).map((child) => (
            <TreeNodeRow key={child.path} node={child} depth={depth + 1} />
          ))}
      </li>
    )
  }

  return (
    <li>
      <button
        type="button"
        style={pad}
        onClick={() => {
          // Handoff to Changes (canonical) + open the existing diff tab.
          openChanges({ path: node.path })
        }}
        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 pl-6 text-left text-xs hover:bg-accent hover:text-accent-foreground"
        title={node.path}
      >
        <File className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-mono text-foreground">{node.name}</span>
        <StatChips additions={node.additions} deletions={node.deletions} />
      </button>
    </li>
  )
}

function StatChips({
  additions,
  deletions,
}: {
  additions?: number
  deletions?: number
}): React.JSX.Element | null {
  if (additions === undefined && deletions === undefined) return null
  return (
    <span className="shrink-0 font-mono text-2xs tabular-nums">
      {additions !== undefined && <span className="text-diff-add-emphasis">+{additions}</span>}
      {additions !== undefined && deletions !== undefined && (
        <span className="text-muted-foreground/40"> </span>
      )}
      {deletions !== undefined && <span className="text-diff-del-emphasis">−{deletions}</span>}
    </span>
  )
}
