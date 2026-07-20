import { Button } from '@renderer/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@renderer/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@renderer/components/ui/sidebar'
import { Textarea } from '@renderer/components/ui/textarea'
import { useCommit, useCommitConventions, useStageAll } from '@renderer/hooks/use-commit'
import { useGitFlow } from '@renderer/hooks/use-git-flow'
import { applyCommitPrefix, parseCommitPrefix } from '@renderer/lib/commit-message'
import { compactButtonClass } from '@renderer/lib/controls'
import { kbdLabel } from '@renderer/lib/keyboard'
import { cn } from '@renderer/lib/utils'
import { useCommitDraftStore } from '@renderer/stores/commit-draft'
import { useRepoStore } from '@renderer/stores/repo'
import { ChevronsUpDown, FileMinus2, FilePlus2, GitCommitHorizontal } from 'lucide-react'
import { useState } from 'react'

/**
 * A combobox token (`type` / `scope`) that inserts a conventional-commit prefix
 * into the message — pick a value the repo already uses or type a brand-new one.
 * The selected value is DERIVED from the message text (so manual edits keep it in
 * sync); choosing rewrites the message's leading prefix.
 */
function CommitTokenSelect({
  kind,
  value,
  options,
  onChange,
  disabled,
}: {
  kind: 'type' | 'scope'
  value: string | null
  options: string[]
  onChange: (value: string | null) => void
  disabled?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const q = query.trim()
  const filtered = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()))
  const canCreate = q !== '' && !options.includes(q)
  const display = value ? (kind === 'scope' ? `(${value})` : value) : kind
  const choose = (next: string | null): void => {
    onChange(next)
    setOpen(false)
    setQuery('')
  }
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn(
              compactButtonClass,
              'rounded-md px-2 font-mono',
              !value && 'text-muted-foreground',
            )}
          >
            {display}
            <ChevronsUpDown className="size-3 opacity-50" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-44 rounded-xl p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={`Add ${kind}…`}
            className="text-xs"
          />
          <CommandList>
            {filtered.length === 0 && !canCreate && <CommandEmpty>No {kind}s yet.</CommandEmpty>}
            {value && (
              <CommandItem
                value="__clear__"
                onSelect={() => choose(null)}
                className="text-xs text-muted-foreground"
              >
                Clear {kind}
              </CommandItem>
            )}
            {filtered.map((o) => (
              <CommandItem
                key={o}
                value={o}
                onSelect={() => choose(o)}
                className="font-mono text-xs"
              >
                {kind === 'scope' ? `(${o})` : o}
              </CommandItem>
            ))}
            {canCreate && (
              <CommandItem value={q} onSelect={() => choose(q)} className="font-mono text-xs">
                Add “{q}”
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function CommitGroup(): React.JSX.Element {
  // The draft is keyed by repo path and lives in a persisted store so it survives the
  // Quick Access section unmounting on sidebar-tab switches (and a reload).
  const repoPath = useRepoStore((s) => s.repo?.path ?? '')
  const message = useCommitDraftStore((s) => s.messages[repoPath] ?? '')
  const setMessage = useCommitDraftStore((s) => s.setMessage)
  const clearMessage = useCommitDraftStore((s) => s.clearMessage)
  const [staged, setStaged] = useState<{ text: string; failed: boolean } | null>(null)
  const conventions = useCommitConventions()
  const {
    commit: runCommit,
    isCommitting,
    error,
  } = useCommit(() => {
    clearMessage(repoPath)
    setStaged(null)
  })
  const { stageAll, unstageAll, isStaging } = useStageAll()
  const { groups } = useGitFlow()

  // "Stage all" flips to "Unstage all" once every change is fully staged with
  // nothing left in the working tree — at that point the only useful action is
  // to undo the staging. Push lives only in Quick Commands (Suggested + Commands
  // grid) — a second Push under Commit was a duplicate.
  const files = groups?.flatMap((g) => g.files) ?? []
  const allStaged = files.length > 0 && files.every((f) => f.staged && !f.unstaged)

  if (!conventions) {
    return (
      <SidebarGroup className="px-3">
        <SidebarGroupLabel className="px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Commit
        </SidebarGroupLabel>
      </SidebarGroup>
    )
  }

  // The textarea is the source of truth — the tokens just read/rewrite its prefix,
  // and a freeform message commits with no prefix at all.
  const { type, scope } = parseCommitPrefix(message)
  const ready = applyCommitPrefix(message, null, null).trim() !== ''

  const setType = (next: string | null): void =>
    setMessage(
      repoPath,
      applyCommitPrefix(message, next, next ? parseCommitPrefix(message).scope : null),
    )
  const setScope = (next: string | null): void =>
    setMessage(repoPath, applyCommitPrefix(message, parseCommitPrefix(message).type, next))

  const commit = (): void => {
    if (!ready || isCommitting) return
    runCommit(message.trim())
  }

  const toggleStaging = async (): Promise<void> => {
    if (isStaging) return
    setStaged(null)
    try {
      if (allStaged) {
        await unstageAll()
        setStaged({ text: 'Unstaged all changes', failed: false })
      } else {
        await stageAll()
        setStaged({ text: 'Staged all changes', failed: false })
      }
    } catch (e) {
      setStaged({ text: e instanceof Error ? e.message : String(e), failed: true })
    }
  }

  return (
    <SidebarGroup className="px-3">
      <SidebarGroupLabel className="px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Commit
      </SidebarGroupLabel>
      <SidebarGroupContent className="px-1">
        <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-2.5">
          <div className="flex items-center gap-1.5">
            <CommitTokenSelect
              kind="type"
              value={type}
              options={conventions.types}
              onChange={setType}
            />
            <CommitTokenSelect
              kind="scope"
              value={scope}
              options={conventions.scopes}
              onChange={setScope}
              disabled={!type}
            />
          </div>
          <Textarea
            value={message}
            onChange={(e) => setMessage(repoPath, e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') commit()
            }}
            placeholder={`Commit message — ${kbdLabel('mod', '↵')} to commit`}
            aria-label="Commit message"
            rows={3}
            className="min-h-16 resize-none rounded-md text-sm-minus md:text-sm-minus"
          />
          {staged && (
            <p
              className={cn(
                'whitespace-pre-wrap font-mono text-2xs',
                staged.failed ? 'text-destructive' : 'text-success',
              )}
            >
              {staged.text}
            </p>
          )}
          {error && (
            <p className="whitespace-pre-wrap font-mono text-2xs text-destructive">
              {error.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className={cn(compactButtonClass, 'flex-1 rounded-md')}
              disabled={isStaging}
              onClick={toggleStaging}
            >
              {allStaged ? <FileMinus2 /> : <FilePlus2 />}
              {isStaging
                ? allStaged
                  ? 'Unstaging…'
                  : 'Staging…'
                : allStaged
                  ? 'Unstage all'
                  : 'Stage all'}
            </Button>
            <Button
              size="sm"
              className={cn(compactButtonClass, 'flex-1 rounded-md')}
              disabled={!ready || isCommitting}
              onClick={commit}
            >
              <GitCommitHorizontal />
              {isCommitting ? 'Committing…' : 'Commit'}
            </Button>
          </div>
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
