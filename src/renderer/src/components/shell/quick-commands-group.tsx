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
  CircleCheck,
  CircleX,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
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

type CommandResult = { label: string; output: string; failed: boolean }

// The run output used to render as a raw inline terminal; now it's a dismissible
// card — a status header (command + ✓/✗) over the captured output.
function ResultCard({
  result,
  onDismiss,
}: {
  result: CommandResult
  onDismiss: () => void
}): React.JSX.Element {
  return (
    <div className="mt-0.5 overflow-hidden rounded-md border border-border/60 bg-card">
      <div className="flex items-center gap-2 border-b border-border/60 px-2.5 py-1.5">
        {result.failed ? (
          <CircleX className="size-3.5 shrink-0 text-destructive" />
        ) : (
          <CircleCheck className="size-3.5 shrink-0 text-success" />
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{result.label}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss result"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <pre
        className={cn(
          'max-h-44 overflow-auto whitespace-pre-wrap px-2.5 py-2 font-mono text-[10px] leading-relaxed',
          result.failed ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {result.output}
      </pre>
    </div>
  )
}

export function QuickCommandsGroup(): React.JSX.Element {
  const [running, setRunning] = useState<string | null>(null)
  const [result, setResult] = useState<CommandResult | null>(null)
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
      <SidebarGroupLabel className="px-2 uppercase tracking-wider text-muted-foreground">
        Quick commands
      </SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-1.5 px-2">
        {suggestions.length > 0 && (
          <div className="flex flex-col gap-1">
            {suggestions.map((suggestion) => {
              const command = QUICK_COMMANDS.find((c) => c.id === suggestion.command)
              if (!command) return null
              return (
                <Button
                  key={suggestion.command}
                  variant="outline"
                  className="h-auto justify-start gap-2 border-ink-amber/30 py-1.5 text-left"
                  disabled={running !== null}
                  onClick={() => run(command)}
                >
                  <Sparkles className="size-3.5 shrink-0 text-ink-amber" />
                  <span className="flex min-w-0 flex-col items-start">
                    <span className="truncate font-mono text-sm font-normal">{command.label}</span>
                    <span className="truncate text-[10px] font-normal text-muted-foreground">
                      {suggestion.reason}
                    </span>
                  </span>
                </Button>
              )
            })}
          </div>
        )}
        {QUICK_COMMANDS.map((command) => (
          <Button
            key={command.id}
            variant="outline"
            size="sm"
            className="justify-start gap-2 font-mono text-sm font-normal"
            disabled={running !== null}
            onClick={() => run(command)}
          >
            {running === command.id ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <command.icon className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{command.label}</span>
          </Button>
        ))}
        {result && <ResultCard result={result} onDismiss={() => setResult(null)} />}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
