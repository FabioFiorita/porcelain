import { Button } from '@renderer/components/ui/button'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@renderer/components/ui/sidebar'
import { useQuickCommand } from '@renderer/hooks/use-commit'
import { useGitSuggestions } from '@renderer/hooks/use-git-flow'
import { cn } from '@renderer/lib/utils'
import {
  Archive,
  ArchiveRestore,
  ArrowDownToLine,
  ArrowUpFromLine,
  Info,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'

// mirrors the QUICK_COMMANDS whitelist in src/main/git.ts — only these ids run.
const QUICK_COMMANDS = [
  { id: 'status', label: 'git status', icon: Info },
  { id: 'pull', label: 'git pull', icon: ArrowDownToLine },
  { id: 'push', label: 'git push', icon: ArrowUpFromLine },
  { id: 'fetch', label: 'git fetch --all --prune', icon: RefreshCw },
  { id: 'stash', label: 'git stash', icon: Archive },
  { id: 'stash-pop', label: 'git stash pop', icon: ArchiveRestore },
]

export function QuickCommandsGroup(): React.JSX.Element {
  const [running, setRunning] = useState<string | null>(null)
  const [result, setResult] = useState<{ label: string; output: string; failed: boolean } | null>(
    null,
  )
  const runCommand = useQuickCommand()
  const suggestions = useGitSuggestions()

  const run = async (command: { id: string; label: string }): Promise<void> => {
    if (running) return
    setRunning(command.id)
    try {
      const output = await runCommand(command.id)
      setResult({ label: command.label, output: output || '(no output)', failed: false })
    } catch (error) {
      setResult({
        label: command.label,
        output: error instanceof Error ? error.message : String(error),
        failed: true,
      })
    } finally {
      setRunning(null)
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Quick commands</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-0.5">
        {suggestions.length > 0 && (
          <div className="mb-1 flex flex-col gap-0.5">
            {suggestions.map((suggestion) => {
              const command = QUICK_COMMANDS.find((c) => c.id === suggestion.command)
              if (!command) return null
              return (
                <Button
                  key={suggestion.command}
                  variant="ghost"
                  size="sm"
                  className="h-auto justify-start py-1 text-left"
                  disabled={running !== null}
                  onClick={() => run(command)}
                >
                  <Sparkles className="size-3 shrink-0 text-amber-400" />
                  <span className="flex min-w-0 flex-col items-start">
                    <span className="font-mono text-xs">{command.label}</span>
                    <span className="text-[10px] text-muted-foreground">{suggestion.reason}</span>
                  </span>
                </Button>
              )
            })}
          </div>
        )}
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
              className={cn(
                'max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10px]',
                result.failed ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {result.output}
            </pre>
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
