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
import {
  Archive,
  ArchiveRestore,
  ArrowDownToLine,
  ArrowUpFromLine,
  GitCommitHorizontal,
  Info,
  RefreshCw,
} from 'lucide-react'
import { useState } from 'react'
import { TreeNode } from './file-tree'
import { RightSidebarResizeHandle } from './sidebar-resize-handle'

const QUICK_COMMANDS = [
  { id: 'status', label: 'git status', icon: Info },
  { id: 'pull', label: 'git pull', icon: ArrowDownToLine },
  { id: 'push', label: 'git push', icon: ArrowUpFromLine },
  { id: 'fetch', label: 'git fetch --all --prune', icon: RefreshCw },
  { id: 'stash', label: 'git stash', icon: Archive },
  { id: 'stash-pop', label: 'git stash pop', icon: ArchiveRestore },
]

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
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const [running, setRunning] = useState<string | null>(null)
  const [result, setResult] = useState<{ label: string; output: string; failed: boolean } | null>(
    null,
  )
  const runMutation = trpc.gitQuickCommand.useMutation()

  const run = async (command: { id: string; label: string }): Promise<void> => {
    if (!repo || running) return
    setRunning(command.id)
    try {
      const output = await runMutation.mutateAsync({ repoPath: repo.path, command: command.id })
      setResult({ label: command.label, output: output || '(no output)', failed: false })
    } catch (error) {
      setResult({
        label: command.label,
        output: error instanceof Error ? error.message : String(error),
        failed: true,
      })
    } finally {
      setRunning(null)
      // pull/stash/push all change repo state; refresh everything that's mounted
      await utils.invalidate()
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Quick commands</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-0.5">
        {QUICK_COMMANDS.map((command) => (
          <Button
            key={command.id}
            variant="ghost"
            size="sm"
            className="h-7 justify-start font-mono text-xs"
            disabled={running !== null}
            onClick={() => run(command)}
          >
            <command.icon className="size-3 text-muted-foreground" />
            {running === command.id ? `${command.label}…` : command.label}
          </Button>
        ))}
        {result && (
          <div className="mt-1 px-2">
            <p className="font-mono text-[10px] text-muted-foreground">$ {result.label}</p>
            <pre
              className={`max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10px] ${
                result.failed ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              {result.output}
            </pre>
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function CommitGroup(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
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
        <Button
          size="sm"
          variant="secondary"
          disabled={!ready || commitMutation.isLoading}
          onClick={commit}
        >
          <GitCommitHorizontal />
          {commitMutation.isLoading ? 'Committing…' : 'Commit all'}
        </Button>
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
      <RightSidebarResizeHandle />
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
