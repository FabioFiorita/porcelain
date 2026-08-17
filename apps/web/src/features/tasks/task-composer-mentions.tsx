import type { SearchResult } from '@porcelain/contracts/search'
import { cn } from '@renderer/lib/utils'
import { TestIds } from '@shared/test-ids'
import { Folder } from 'lucide-react'
import type { BodyMention } from './task-mentions'

export function TaskComposerMentions({
  mention,
  caret,
  hasWorktree,
  fileQuery,
  fileHits,
  tagHits,
  highlight,
  onAcceptFile,
  onAcceptTag,
}: {
  mention: BodyMention | null
  caret: { top: number; left: number }
  hasWorktree: boolean
  fileQuery: string
  fileHits: readonly SearchResult[]
  tagHits: readonly string[]
  highlight: number
  onAcceptFile: (result: SearchResult) => void
  onAcceptTag: (tag: string) => void
}): React.JSX.Element | null {
  if (mention === null) return null
  return (
    <ul
      data-testid={TestIds.tasksComposerFileSearch}
      className="absolute z-20 w-64 max-w-full overflow-auto rounded-md border bg-popover p-1 text-xs shadow-md"
      style={{ top: caret.top + 18, left: Math.max(8, caret.left) }}
    >
      {mention.kind === 'file' && !hasWorktree && (
        <li className="px-2 py-1.5 text-muted-foreground">Pick a project to @ a file.</li>
      )}
      {mention.kind === 'file' && hasWorktree && fileQuery.trim() === '' && (
        <li className="px-2 py-1.5 text-muted-foreground">Type to search files.</li>
      )}
      {mention.kind === 'file' &&
        fileHits.map((result, index) => (
          <li key={`${result.kind}:${result.path}`}>
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left',
                index === highlight ? 'bg-accent' : 'hover:bg-accent',
              )}
              onClick={() => onAcceptFile(result)}
            >
              <Folder className="size-3 shrink-0" />
              <span className="truncate">{result.path}</span>
            </button>
          </li>
        ))}
      {mention.kind === 'tag' &&
        tagHits.map((tag, index) => (
          <li key={tag}>
            <button
              type="button"
              className={cn(
                'w-full rounded-sm px-2 py-1 text-left',
                index === highlight ? 'bg-accent' : 'hover:bg-accent',
              )}
              onClick={() => onAcceptTag(tag)}
            >
              #{tag}
            </button>
          </li>
        ))}
    </ul>
  )
}
