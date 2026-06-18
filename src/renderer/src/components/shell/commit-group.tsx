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
import { applyCommitPrefix, parseCommitPrefix } from '@renderer/lib/commit-message'
import { cn } from '@renderer/lib/utils'
import { ChevronsUpDown, FilePlus2, GitCommitHorizontal } from 'lucide-react'
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
              'h-6 rounded-md px-2 font-mono text-xs',
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
          <CommandInput value={query} onValueChange={setQuery} placeholder={`Add ${kind}…`} />
          <CommandList>
            {filtered.length === 0 && !canCreate && <CommandEmpty>No {kind}s yet.</CommandEmpty>}
            {value && (
              <CommandItem
                value="__clear__"
                onSelect={() => choose(null)}
                className="text-muted-foreground"
              >
                Clear {kind}
              </CommandItem>
            )}
            {filtered.map((o) => (
              <CommandItem key={o} value={o} onSelect={() => choose(o)} className="font-mono">
                {kind === 'scope' ? `(${o})` : o}
              </CommandItem>
            ))}
            {canCreate && (
              <CommandItem value={q} onSelect={() => choose(q)} className="font-mono">
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
  const [message, setMessage] = useState('')
  const [staged, setStaged] = useState<{ text: string; failed: boolean } | null>(null)
  const conventions = useCommitConventions()
  const {
    commit: runCommit,
    isCommitting,
    error,
  } = useCommit(() => {
    setMessage('')
    setStaged(null)
  })
  const { stageAll, isStaging } = useStageAll()

  if (!conventions) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="px-2 uppercase tracking-wider text-muted-foreground">
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
    setMessage((m) => applyCommitPrefix(m, next, next ? parseCommitPrefix(m).scope : null))
  const setScope = (next: string | null): void =>
    setMessage((m) => applyCommitPrefix(m, parseCommitPrefix(m).type, next))

  const commit = (): void => {
    if (!ready || isCommitting) return
    runCommit(message.trim())
  }

  const stage = async (): Promise<void> => {
    if (isStaging) return
    setStaged(null)
    try {
      await stageAll()
      setStaged({ text: 'Staged all changes', failed: false })
    } catch (e) {
      setStaged({ text: e instanceof Error ? e.message : String(e), failed: true })
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="px-2 uppercase tracking-wider text-muted-foreground">
        Commit
      </SidebarGroupLabel>
      <SidebarGroupContent className="px-2">
        <div className="glaze-tile flex flex-col gap-2.5 p-2.5 [--tile-fill:var(--surface-2)]">
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
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') commit()
            }}
            placeholder="Commit message — ⌘↵ to commit"
            aria-label="Commit message"
            rows={3}
            className="min-h-16 resize-none rounded-md text-sm"
          />
          {staged && (
            <p
              className={cn(
                'whitespace-pre-wrap font-mono text-[10px]',
                staged.failed ? 'text-destructive' : 'text-success',
              )}
            >
              {staged.text}
            </p>
          )}
          {error && (
            <p className="whitespace-pre-wrap font-mono text-[10px] text-destructive">
              {error.message}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-md"
              disabled={isStaging}
              onClick={stage}
            >
              <FilePlus2 />
              {isStaging ? 'Staging…' : 'Stage all'}
            </Button>
            <Button
              size="sm"
              className="rounded-md"
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
