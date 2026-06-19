import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@renderer/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { useBranch, useBranches, useCheckout } from '@renderer/hooks/use-worktrees'
import { useRepoStore } from '@renderer/stores/repo'
import { Check, GitBranch } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

// The footer's left chip: the current branch, opening a searchable picker of local
// and remote branches that checks the chosen one out in place. Checking out a
// remote-only branch lets git DWIM a local tracking branch off it. Distinct from
// the worktrees switcher, which swaps the whole worktree/directory. A dirty tree
// makes git refuse — that message surfaces as a toast rather than silently failing.
//
// Filtering is client-side (cmdk-style, `shouldFilter={false}` + manual match) over
// the full branch list, scrolled in a capped-height list — no pagination: even a
// few hundred branches narrow instantly as you type. If a monorepo ever pushes this
// into the thousands and the DOM size bites, the fix is virtualization, not paging.
export function BranchSwitcher(): React.JSX.Element | null {
  const repo = useRepoStore((s) => s.repo)
  const branch = useBranch()
  const branches = useBranches()
  const checkout = useCheckout()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  if (!repo) return null

  const q = query.trim().toLowerCase()
  const local = branches.filter((b) => b.remote === null && b.name.toLowerCase().includes(q))
  const remote = branches.filter(
    (b) => b.remote !== null && `${b.remote}/${b.name}`.toLowerCase().includes(q),
  )

  const switchBranch = async (target: string): Promise<void> => {
    setOpen(false)
    setQuery('')
    if (target === branch) return
    try {
      await checkout(target)
      toast.success(`Switched to ${target}`)
    } catch (error) {
      toast.error('Checkout failed', {
        description: error instanceof Error ? error.message : String(error),
      })
    }
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
          <button
            type="button"
            className="app-no-drag flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <GitBranch className="size-3.5 shrink-0" />
            <span className="truncate">{branch ?? '…'}</span>
          </button>
        }
      />
      <PopoverContent side="top" align="start" className="w-64 rounded-xl p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Switch branch…"
            className="text-xs"
          />
          <CommandList>
            {local.length === 0 && remote.length === 0 && (
              <CommandEmpty>No branches found.</CommandEmpty>
            )}
            {local.length > 0 && (
              <CommandGroup heading="Local">
                {local.map((b) => (
                  <CommandItem key={b.name} value={b.name} onSelect={() => switchBranch(b.name)}>
                    {b.name === branch ? (
                      <Check className="shrink-0" />
                    ) : (
                      <span className="size-4 shrink-0" />
                    )}
                    <span className="truncate">{b.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {remote.length > 0 && (
              <CommandGroup heading="Remote">
                {remote.map((b) => (
                  <CommandItem
                    key={`${b.remote}/${b.name}`}
                    value={`${b.remote}/${b.name}`}
                    onSelect={() => switchBranch(b.name)}
                  >
                    <span className="size-4 shrink-0" />
                    <span className="truncate">
                      <span className="text-muted-foreground">{b.remote}/</span>
                      {b.name}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
