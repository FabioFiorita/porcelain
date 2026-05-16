import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
} from '@renderer/components/ui/sidebar'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { trpc } from '@renderer/lib/trpc'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useTerminalStore } from '@renderer/stores/terminal'
import { GitCommitHorizontal, SquareTerminal } from 'lucide-react'
import { useState } from 'react'
import { TreeNode } from './file-tree'

const QUICK_COMMANDS = [
  'git status',
  'git pull',
  'git push',
  'git fetch --all --prune',
  'git stash',
  'git stash pop',
]

/** Open the terminal pane and type into it (no newline — the user confirms). */
function useInsertInTerminal(): (text: string) => void {
  const openTerminal = usePreferencesStore((s) => s.openTerminal)
  const insertInput = useTerminalStore((s) => s.insertInput)
  return (text) => {
    openTerminal()
    void insertInput(text)
  }
}

function PinnedGroup(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const { data: entries } = trpc.pinnedEntries.useQuery(repo?.path ?? '', {
    enabled: repo !== null,
  })

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Pinned</SidebarGroupLabel>
      <SidebarGroupContent>
        {entries === undefined || entries.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            Right-click a file or folder in the tree to pin it here.
          </p>
        ) : (
          <SidebarMenu>
            {entries.map((entry) => (
              <TreeNode key={entry.path} entry={entry} />
            ))}
          </SidebarMenu>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function QuickCommandsGroup(): React.JSX.Element {
  const insert = useInsertInTerminal()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Quick commands</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-0.5">
        {QUICK_COMMANDS.map((command) => (
          <Button
            key={command}
            variant="ghost"
            size="sm"
            className="h-7 justify-start font-mono text-xs"
            onClick={() => insert(command)}
          >
            {command}
          </Button>
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

const quoteForShell = (text: string): string => text.replace(/(["\\$`])/g, '\\$1')

function CommitGroup(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const insert = useInsertInTerminal()
  const utils = trpc.useUtils()
  const [type, setType] = useState<string | null>(null)
  const [scope, setScope] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const { data: conventions } = trpc.gitCommitConventions.useQuery(repo?.path ?? '', {
    enabled: repo !== null,
  })
  const commitMutation = trpc.gitCommit.useMutation({
    onSuccess: async () => {
      setMessage('')
      await Promise.all([
        utils.gitFlow.invalidate(),
        utils.gitLog.invalidate(),
        utils.gitCommitConventions.invalidate(),
      ])
    },
  })

  if (!conventions) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>Commit</SidebarGroupLabel>
      </SidebarGroup>
    )
  }

  const prefix = type ? `${type}${scope ? `(${scope})` : ''}: ` : ''
  const subject = `${prefix}${message.trim()}`
  const ready = type !== null && message.trim() !== ''

  const commit = (): void => {
    if (!ready || !repo || commitMutation.isLoading) return
    commitMutation.mutate({ repoPath: repo.path, message: subject })
  }

  const insertCommand = (): void => {
    if (!type) return
    insert(`git commit -m "${quoteForShell(subject)}"`)
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Commit</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-2 px-2">
        <ToggleGroup
          value={type ? [type] : []}
          onValueChange={(value: string[]) => setType(value[0] ?? null)}
          className="flex-wrap justify-start gap-1"
        >
          {conventions.types.map((t) => (
            <ToggleGroupItem key={t} value={t} size="sm" className="h-6 px-2 font-mono text-xs">
              {t}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {conventions.scopes.length > 0 && (
          <ToggleGroup
            value={scope ? [scope] : []}
            onValueChange={(value: string[]) => setScope(value[0] ?? null)}
            className="flex-wrap justify-start gap-1"
          >
            {conventions.scopes.map((s) => (
              <ToggleGroupItem key={s} value={s} size="sm" className="h-6 px-2 font-mono text-xs">
                ({s})
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          placeholder="commit message"
          aria-label="Commit message"
          className="h-7 text-xs"
        />
        {prefix && (
          <p className="truncate font-mono text-[10px] text-muted-foreground">{subject}</p>
        )}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            disabled={!ready || commitMutation.isLoading}
            onClick={commit}
          >
            <GitCommitHorizontal />
            {commitMutation.isLoading ? 'Committing…' : 'Commit all'}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={!type}
            onClick={insertCommand}
            aria-label="Insert commit command in terminal"
          >
            <SquareTerminal />
          </Button>
        </div>
        {commitMutation.error && (
          <p className="whitespace-pre-wrap font-mono text-[10px] text-destructive">
            {commitMutation.error.message}
          </p>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

// Sections follow the left sidebar's active tab: pins belong to browsing
// files, git actions belong to reviewing changes/history.
export function RightSidebar(): React.JSX.Element {
  const sidebarTab = usePreferencesStore((s) => s.sidebarTab)

  return (
    <Sidebar side="right" collapsible="offcanvas">
      <SidebarHeader className="app-drag h-10 flex-row items-center border-b py-0">
        <span className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Quick access
        </span>
      </SidebarHeader>
      <SidebarContent>
        {sidebarTab === 'files' && <PinnedGroup />}
        {sidebarTab !== 'files' && <QuickCommandsGroup />}
        {sidebarTab === 'changes' && <CommitGroup />}
      </SidebarContent>
    </Sidebar>
  )
}
