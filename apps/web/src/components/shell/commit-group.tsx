import type { CommitGroupGenerationGroup } from '@porcelain/contracts'
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
import {
  useApplyCommitGroups,
  useCommit,
  useCommitConventions,
  useCommitGeneration,
  useGitFlow,
  useStageAll,
} from '@renderer/features/git'
import { applyCommitPrefix, parseCommitPrefix } from '@renderer/lib/commit-message'
import { compactButtonClass } from '@renderer/lib/controls'
import { kbdLabel } from '@renderer/lib/keyboard'
import { cn } from '@renderer/lib/utils'
import { useCommitDraftStore } from '@renderer/stores/commit-draft'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import {
  Check,
  ChevronsUpDown,
  FileMinus2,
  FilePlus2,
  GitCommitHorizontal,
  Layers,
  Sparkles,
} from 'lucide-react'
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
  const handleChoose = (next: string | null): void => {
    onChange(next)
    setOpen(false)
    setQuery('')
  }
  return (
    <Popover
      open={open}
      onOpenChange={(next: boolean): void => {
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
                onSelect={() => handleChoose(null)}
                className="text-xs text-muted-foreground"
              >
                Clear {kind}
              </CommandItem>
            )}
            {filtered.map((o) => (
              <CommandItem
                key={o}
                value={o}
                onSelect={() => handleChoose(o)}
                className="font-mono text-xs"
              >
                {kind === 'scope' ? `(${o})` : o}
              </CommandItem>
            ))}
            {canCreate && (
              <CommandItem value={q} onSelect={() => handleChoose(q)} className="font-mono text-xs">
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
  // Commands popover unmounting on surface switches (and a reload).
  const repoPath = useProjectSelectionStore((s) => s.project?.path ?? '')
  const message = useCommitDraftStore((s) => s.messages[repoPath] ?? '')
  const setMessage = useCommitDraftStore((s) => s.setMessage)
  const clearMessage = useCommitDraftStore((s) => s.clearMessage)
  const [staged, setStaged] = useState<{ text: string; failed: boolean } | null>(null)
  const [generatedGroups, setGeneratedGroups] = useState<CommitGroupGenerationGroup[] | null>(null)
  const conventions = useCommitConventions()
  const {
    commit: runCommit,
    isCommitting,
    error,
  } = useCommit(() => {
    clearMessage(repoPath)
    setStaged(null)
  })
  const { generateMessage, generateGroups, isGenerating } = useCommitGeneration()
  const { stageAll, unstageAll, isStaging } = useStageAll()
  const { applyGroups, isApplying } = useApplyCommitGroups()
  const { groups } = useGitFlow()

  // "Stage all" flips to "Unstage all" once every change is fully staged with
  // nothing left in the working tree — at that point the only useful action is
  // to undo the staging. Push lives only in Quick Commands (Suggested + Commands
  // grid) — a second Push under Commit was a duplicate.
  const files = groups?.flatMap((g) => g.files) ?? []
  const hasStaged = files.some((file) => file.staged === true)
  const hasUnstaged = files.some((file) => file.unstaged === true)
  const allStaged = files.length > 0 && files.every((f) => f.staged && !f.unstaged)
  const treeClean = files.length === 0

  if (!conventions) {
    return (
      <SidebarGroup className="p-0">
        <SidebarGroupLabel className="h-6 px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Commit
        </SidebarGroupLabel>
      </SidebarGroup>
    )
  }

  // The textarea is the source of truth — the tokens just read/rewrite its prefix,
  // and a freeform message commits with no prefix at all.
  const { type, scope } = parseCommitPrefix(message)
  const ready = applyCommitPrefix(message, null, null).trim() !== '' && !treeClean

  const handleSetType = (next: string | null): void =>
    setMessage(
      repoPath,
      applyCommitPrefix(message, next, next ? parseCommitPrefix(message).scope : null),
    )
  const handleSetScope = (next: string | null): void =>
    setMessage(repoPath, applyCommitPrefix(message, parseCommitPrefix(message).type, next))

  const handleCommit = (): void => {
    if (!ready || isCommitting) return
    runCommit(message.trim())
  }

  const handleToggleStaging = (): void => {
    if (isStaging) return
    setStaged(null)
    runUserAction(
      async () => {
        if (allStaged) {
          await unstageAll()
          setStaged({ text: 'Unstaged all changes', failed: false })
        } else {
          await stageAll()
          setStaged({ text: 'Staged all changes', failed: false })
        }
      },
      (e) => {
        setStaged({ text: e instanceof Error ? e.message : String(e), failed: true })
      },
    )
  }

  const handleGenerateMessage = (): void => {
    if (!hasStaged || isGenerating) return
    setStaged(null)
    runUserAction(
      async () => {
        const generated = await generateMessage()
        setMessage(repoPath, generated)
        setGeneratedGroups(null)
        setStaged({ text: 'Generated commit message', failed: false })
      },
      (e) => {
        setStaged({ text: e instanceof Error ? e.message : String(e), failed: true })
      },
    )
  }

  const handleGenerateGroups = (): void => {
    if (hasStaged || !hasUnstaged || isGenerating) return
    setStaged(null)
    runUserAction(
      async () => {
        const generated = await generateGroups()
        setGeneratedGroups(generated)
        setStaged({
          text: `Generated ${generated.length} commit group${generated.length === 1 ? '' : 's'}`,
          failed: false,
        })
      },
      (e) => {
        setStaged({ text: e instanceof Error ? e.message : String(e), failed: true })
      },
    )
  }

  /**
   * Accept the whole proposal. The daemon stages and commits every group in one call, so the
   * human never stages or commits a group by hand — that was the point of the feature.
   * A partial batch is not an error to swallow: the surviving groups stay on screen with the
   * outcome, so the human can see what landed and retry the rest.
   */
  const handleAcceptGroups = (): void => {
    if (generatedGroups === null || isApplying) return
    setStaged(null)
    runUserAction(
      async () => {
        const results = await applyGroups(generatedGroups)
        const committed = results.filter((r) => r.status === 'committed')
        const failure = results.find((r) => r.status === 'failed')
        if (failure === undefined) {
          setGeneratedGroups(null)
          clearMessage(repoPath)
          setStaged({
            text: `Committed ${committed.length} group${committed.length === 1 ? '' : 's'}`,
            failed: false,
          })
          return
        }
        setGeneratedGroups(
          results
            .filter((r) => r.status !== 'committed')
            .map((r) => ({ files: r.files, message: r.message })),
        )
        setStaged({
          text: `Committed ${committed.length} of ${results.length} groups — “${failure.message}” failed: ${failure.error ?? 'unknown error'}`,
          failed: true,
        })
      },
      (e) => {
        setStaged({ text: e instanceof Error ? e.message : String(e), failed: true })
      },
    )
  }

  // Only the commit mutation reports here; generation failures land on the status
  // line above via `staged`, so a failed generate is not printed twice.
  const displayedError = error

  return (
    <SidebarGroup data-testid={TestIds.commitGroup} className="p-0">
      <SidebarGroupLabel className="h-6 px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Commit
      </SidebarGroupLabel>
      <SidebarGroupContent>
        {treeClean && (
          <p className="mb-2 px-0.5 text-2xs text-muted-foreground">
            Working tree clean — nothing to stage or commit.
          </p>
        )}
        <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-2.5">
          <div className="flex items-center gap-1.5">
            <CommitTokenSelect
              kind="type"
              value={type}
              options={conventions.types}
              onChange={handleSetType}
              disabled={treeClean}
            />
            <CommitTokenSelect
              kind="scope"
              value={scope}
              options={conventions.scopes}
              onChange={handleSetScope}
              disabled={!type || treeClean}
            />
          </div>
          <Textarea
            value={message}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>): void =>
              setMessage(repoPath, e.target.value)
            }
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleCommit()
            }}
            placeholder={
              treeClean ? 'Nothing to commit' : `Commit message — ${kbdLabel('mod', '↵')} to commit`
            }
            aria-label="Commit message"
            rows={3}
            disabled={treeClean}
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
          {displayedError && (
            <p className="whitespace-pre-wrap font-mono text-2xs text-destructive">
              {displayedError.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className={cn(compactButtonClass, 'flex-1 rounded-md')}
              disabled={isStaging || treeClean}
              onClick={handleToggleStaging}
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
              data-testid={TestIds.commitButton}
              onClick={handleCommit}
            >
              <GitCommitHorizontal />
              {isCommitting ? 'Committing…' : 'Commit'}
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant="outline"
              className={cn(compactButtonClass, 'w-full justify-start rounded-md')}
              disabled={!hasStaged || isGenerating}
              data-testid={TestIds.generateCommitMessage}
              onClick={handleGenerateMessage}
            >
              <Sparkles />
              {isGenerating ? 'Generating…' : 'Generate Commit Message'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={cn(compactButtonClass, 'w-full justify-start rounded-md')}
              disabled={hasStaged || !hasUnstaged || isGenerating}
              data-testid={TestIds.generateCommitGroups}
              onClick={handleGenerateGroups}
            >
              <Layers />
              {isGenerating ? 'Generating…' : 'Generate Group Commit'}
            </Button>
          </div>
          {generatedGroups && generatedGroups.length > 0 && (
            <div className="flex flex-col gap-2 border-t pt-2">
              <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Proposed commits
              </p>
              {generatedGroups.map((group, index) => (
                <div key={group.files.join('|')} className="rounded-md border p-2">
                  <p className="text-2xs text-muted-foreground">Commit {index + 1}</p>
                  <p className="whitespace-pre-wrap text-xs font-medium">{group.message}</p>
                  <p className="mt-1 break-words font-mono text-2xs text-muted-foreground">
                    {group.files.join(', ')}
                  </p>
                </div>
              ))}
              <Button
                size="sm"
                className={cn(compactButtonClass, 'w-full justify-start rounded-md')}
                disabled={isApplying}
                data-testid={TestIds.acceptCommitGroups}
                onClick={handleAcceptGroups}
              >
                <Check />
                {isApplying
                  ? 'Committing…'
                  : `Accept all — commit ${generatedGroups.length} group${generatedGroups.length === 1 ? '' : 's'}`}
              </Button>
            </div>
          )}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
