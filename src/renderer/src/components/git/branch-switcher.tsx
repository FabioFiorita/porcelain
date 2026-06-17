import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { useBranch, useBranches, useCheckout } from '@renderer/hooks/use-worktrees'
import { useRepoStore } from '@renderer/stores/repo'
import { Check, GitBranch } from 'lucide-react'
import { toast } from 'sonner'

// The footer's left chip: the current branch, opening a picker of local branches
// that checks the chosen one out in place. Distinct from the worktrees switcher,
// which swaps the whole worktree/directory. A dirty tree makes git refuse — that
// message surfaces as a toast rather than silently failing.
export function BranchSwitcher(): React.JSX.Element | null {
  const repo = useRepoStore((s) => s.repo)
  const branch = useBranch()
  const branches = useBranches()
  const checkout = useCheckout()

  if (!repo) return null

  const switchBranch = async (target: string): Promise<void> => {
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="app-no-drag flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <GitBranch className="size-3.5 shrink-0" />
            <span className="truncate">{branch ?? '…'}</span>
          </button>
        }
      />
      <DropdownMenuContent side="top" align="start" className="w-64">
        {/* Base UI requires GroupLabel inside a Group (Radix did not) */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Branches</DropdownMenuLabel>
          {branches.map((name) => (
            <DropdownMenuItem key={name} onClick={() => switchBranch(name)}>
              {name === branch ? (
                <Check className="shrink-0" />
              ) : (
                <span className="size-4 shrink-0" />
              )}
              <span className="truncate">{name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
