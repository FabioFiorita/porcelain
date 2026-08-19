import { type BranchRef, UPSTREAM_COMPARE_BASE } from '@porcelain/contracts/git'
import { Button } from '@renderer/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@renderer/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { useGitBranches } from '@renderer/features/git'
import { cn } from '@renderer/lib/utils'
import { TestIds } from '@shared/test-ids'
import { Check } from 'lucide-react'
import { useState } from 'react'

function refValue(ref: BranchRef): string {
  return ref.remote === null ? ref.name : `${ref.remote}/${ref.name}`
}

/**
 * The "vs <ref>" label in the Changes header, as a ref picker.
 *
 * The label was already the honest answer to "what am I reading a diff against?";
 * this makes it the control for it too, so changing the comparison is one click
 * where the question is asked rather than a setting somewhere else.
 *
 * `selected` is the base the daemon ACTUALLY measured against, `defaultBase` the
 * one it would pick unasked, and `requested` the reviewer's stored pick. They
 * differ exactly when a pick went stale (branch deleted), and showing `selected`
 * is what keeps the label true while the check mark still admits what was asked
 * for.
 *
 * Remote-tracking refs whose short name also exists locally are not listed
 * separately — `gitBranches` collapses them — so `Upstream` is how you say "just
 * the remote" for the branch you are on.
 */
export function ChangesBasePicker({
  repoPath,
  selected,
  defaultBase,
  requested,
  onSelect,
}: {
  repoPath: string
  selected: string
  defaultBase: string | undefined
  requested: string | undefined
  onSelect: (base: string | null) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const { branches, isFetching } = useGitBranches(repoPath, open)

  // The default entry is identified by the ref it resolves to, so it reads as a
  // ref rather than as a mode — but choosing it CLEARS the pick, which is what
  // keeps "follow the default" following a default that later changes. It is
  // filtered out of the branch groups so one ref is never two rows.
  const defaultOptionValue = defaultBase ?? selected
  const activeValue = requested ?? defaultOptionValue
  const listed = branches.filter((ref) => refValue(ref) !== defaultOptionValue)
  const locals = listed.filter((ref) => ref.remote === null)
  const remotes = listed.filter((ref) => ref.remote !== null)

  const choose = (base: string | null): void => {
    onSelect(base)
    setOpen(false)
  }

  const option = (value: string, label: React.ReactNode, hint?: string): React.JSX.Element => (
    <CommandItem
      key={value}
      value={value}
      data-testid={TestIds.changesBaseOption(value)}
      onSelect={() => choose(value === defaultOptionValue ? null : value)}
      className="font-mono text-xs"
    >
      <Check
        className={cn('size-3.5 shrink-0', activeValue === value ? 'opacity-100' : 'opacity-0')}
      />
      <span className="min-w-0 truncate">{label}</span>
      {hint !== undefined && (
        <span className="ml-auto shrink-0 font-sans text-2xs text-muted-foreground">{hint}</span>
      )}
    </CommandItem>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            data-testid={TestIds.changesBasePicker}
            aria-label={`Comparison base: ${selected}`}
            className="h-5 min-w-0 px-1 text-xs font-normal text-muted-foreground"
          >
            <span className="truncate">vs {selected}</span>
          </Button>
        }
      />
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Compare against…" />
          <CommandList>
            <CommandEmpty>{isFetching ? 'Loading refs…' : 'No matching ref.'}</CommandEmpty>
            <CommandGroup heading="Default">
              {option(defaultOptionValue, defaultOptionValue, 'default')}
              {option(UPSTREAM_COMPARE_BASE, 'Upstream', 'just the remote')}
            </CommandGroup>
            {locals.length > 0 && (
              <CommandGroup heading="Local branches">
                {locals.map((ref) => option(refValue(ref), refValue(ref)))}
              </CommandGroup>
            )}
            {remotes.length > 0 && (
              <CommandGroup heading="Remote branches">
                {remotes.map((ref) => option(refValue(ref), refValue(ref)))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
