import type { BranchRef } from '@porcelain/contracts/git'
import type { CreateHubWorktreeInput, HubProject } from '@porcelain/contracts/projects'
import { Button } from '@renderer/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@renderer/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { useGitBranches } from '@renderer/features/git'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { cn } from '@renderer/lib/utils'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { Check, ChevronsUpDown, GitBranch, LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

function refValue(ref: BranchRef): string {
  return ref.remote === null ? ref.name : `${ref.remote}/${ref.name}`
}

function refLabel(ref: BranchRef): React.JSX.Element {
  if (ref.remote === null) return <>{ref.name}</>
  return (
    <>
      <span className="text-muted-foreground">{ref.remote}/</span>
      {ref.name}
    </>
  )
}

export function CreateWorktreeDialog(props: {
  project: HubProject
  open: boolean
  creating: boolean
  onOpenChange: (open: boolean) => void
  createWorktree: (input: CreateHubWorktreeInput) => Promise<unknown>
}): React.JSX.Element {
  const { branches, isFetching } = useGitBranches(props.project.path, props.open)
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [branch, setBranch] = useState('')
  const [baseRef, setBaseRef] = useState<string | null>(null)
  const [refOpen, setRefOpen] = useState(false)
  const availableRefs = useMemo(() => {
    if (mode === 'new') return branches
    const checkedOut = new Set(props.project.worktrees.map((worktree) => worktree.branch))
    return branches.filter((ref) => ref.remote === null && !checkedOut.has(ref.name))
  }, [branches, mode, props.project.worktrees])

  useEffect(() => {
    if (availableRefs.some((ref) => refValue(ref) === baseRef)) return
    const first = availableRefs[0]
    setBaseRef(first === undefined ? null : refValue(first))
  }, [availableRefs, baseRef])

  const selected = availableRefs.find((ref) => refValue(ref) === baseRef)
  const canSubmit = mode === 'existing' ? baseRef !== null && baseRef !== '' : branch.trim() !== ''
  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (props.creating || !canSubmit) return

    const input: CreateHubWorktreeInput =
      mode === 'existing' && baseRef !== null
        ? { projectId: props.project.id, branch: baseRef, existing: true }
        : {
            projectId: props.project.id,
            branch: branch.trim(),
            ...(baseRef === null ? {} : { baseRef }),
          }
    runUserAction(
      async () => {
        await props.createWorktree(input)
        props.onOpenChange(false)
      },
      (error) => toastUserActionError('Create worktree', error),
    )
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent data-testid={TestIds.hubCreateWorktreeDialog} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New worktree</DialogTitle>
          <DialogDescription>
            Add a worktree for {props.project.name} — a new branch, or an existing one that is not
            already checked out.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium">Branch</span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant={mode === 'new' ? 'secondary' : 'ghost'}
                size="sm"
                data-testid={TestIds.hubCreateWorktreeModeNew}
                onClick={() => setMode('new')}
              >
                New
              </Button>
              <Button
                type="button"
                variant={mode === 'existing' ? 'secondary' : 'ghost'}
                size="sm"
                data-testid={TestIds.hubCreateWorktreeModeExisting}
                onClick={() => setMode('existing')}
              >
                Existing
              </Button>
            </div>
          </div>
          {mode === 'new' && (
            <div className="flex flex-col gap-2">
              <label htmlFor={TestIds.hubCreateWorktreeBranch} className="text-xs font-medium">
                New branch name
              </label>
              <Input
                id={TestIds.hubCreateWorktreeBranch}
                data-testid={TestIds.hubCreateWorktreeBranch}
                autoFocus
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                placeholder="feature/my-change"
                className="font-mono"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium">
              {mode === 'existing' ? 'Existing branch' : 'Create from ref'}
            </span>
            <Popover open={refOpen} onOpenChange={setRefOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between font-mono text-xs"
                    data-testid={TestIds.hubCreateWorktreeBase}
                  >
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {selected === undefined ? 'Current HEAD' : refLabel(selected)}
                      </span>
                    </span>
                    <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
                  </Button>
                }
              />
              <PopoverContent align="start" className="w-[var(--anchor-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search refs…" />
                  <CommandList>
                    {isFetching && (
                      <CommandEmpty className="flex items-center justify-center gap-2">
                        <LoaderCircle className="size-3.5 animate-spin" />
                        Loading refs…
                      </CommandEmpty>
                    )}
                    {!isFetching && availableRefs.length === 0 && (
                      <CommandEmpty>
                        {mode === 'existing'
                          ? 'No unchecked-out local branches are available.'
                          : 'No refs found. The worktree will use current HEAD.'}
                      </CommandEmpty>
                    )}
                    {availableRefs.filter((ref) => ref.remote === null).length > 0 && (
                      <CommandGroup heading="Local">
                        {availableRefs
                          .filter((ref) => ref.remote === null)
                          .map((ref) => {
                            const value = refValue(ref)
                            return (
                              <CommandItem
                                key={value}
                                value={value}
                                onSelect={() => {
                                  setBaseRef(value)
                                  setRefOpen(false)
                                }}
                                className="font-mono text-xs"
                              >
                                <Check
                                  className={cn(
                                    'size-3.5',
                                    baseRef === value ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                                {refLabel(ref)}
                              </CommandItem>
                            )
                          })}
                      </CommandGroup>
                    )}
                    {availableRefs.filter((ref) => ref.remote !== null).length > 0 && (
                      <CommandGroup heading="Remote">
                        {availableRefs
                          .filter((ref) => ref.remote !== null)
                          .map((ref) => {
                            const value = refValue(ref)
                            return (
                              <CommandItem
                                key={value}
                                value={value}
                                onSelect={() => {
                                  setBaseRef(value)
                                  setRefOpen(false)
                                }}
                                className="font-mono text-xs"
                              >
                                <Check
                                  className={cn(
                                    'size-3.5',
                                    baseRef === value ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                                {refLabel(ref)}
                              </CommandItem>
                            )
                          })}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => props.onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              data-testid={TestIds.hubCreateWorktreeSubmit}
              disabled={!canSubmit || props.creating}
            >
              {props.creating && <LoaderCircle className="animate-spin" />}
              Create worktree
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
