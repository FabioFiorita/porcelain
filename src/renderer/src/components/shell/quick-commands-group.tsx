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
  ChevronRight,
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
  { id: 'status', label: 'status', icon: Info },
  { id: 'pull', label: 'pull', icon: ArrowDownToLine },
  { id: 'push', label: 'push', icon: ArrowUpFromLine },
  { id: 'fetch', label: 'fetch', icon: RefreshCw },
  { id: 'stash', label: 'stash', icon: Archive },
  { id: 'stash-pop', label: 'stash pop', icon: ArchiveRestore },
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
    <div className="glaze-tile mt-0.5 overflow-hidden [--tile-fill:var(--surface-2)]">
      <div className="flex items-center gap-2 border-b border-border/60 px-2.5 py-1.5">
        {result.failed ? (
          <CircleX className="size-3.5 shrink-0 text-destructive" />
        ) : (
          <CircleCheck className="size-3.5 shrink-0 text-success" />
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-xs-minus">{result.label}</span>
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
          'max-h-44 overflow-auto whitespace-pre-wrap px-2.5 py-2 font-mono text-2xs leading-relaxed',
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
    <>
      {/* Contextual suggestions ride in their own glaze tile above the command
          set — the agent-free heuristic (behind/ahead/stash/dirty) surfaces the
          one command worth running right now. Kept in our card style rather than
          the mockup's accent treatment. */}
      {suggestions.length > 0 && (
        <SidebarGroup className="px-3">
          <SidebarGroupLabel className="px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Suggested
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-1">
            <div className="glaze-tile flex flex-col gap-0.5 p-1 [--tile-fill:var(--surface-2)]">
              {suggestions.map((suggestion) => {
                const command = QUICK_COMMANDS.find((c) => c.id === suggestion.command)
                if (!command) return null
                return (
                  <Button
                    key={suggestion.command}
                    variant="ghost"
                    className="h-auto justify-start gap-2.5 rounded-md px-2 py-1.5 text-left"
                    disabled={running !== null}
                    onClick={() => run(command)}
                  >
                    {running === command.id ? (
                      <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                    ) : (
                      <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col items-start">
                      <span className="truncate font-mono text-xs font-normal">
                        git {command.label}
                      </span>
                      <span className="truncate text-2xs font-normal text-muted-foreground">
                        {suggestion.reason}
                      </span>
                    </span>
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </Button>
                )
              })}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
      <SidebarGroup className="px-3">
        <SidebarGroupLabel className="px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Commands
        </SidebarGroupLabel>
        <SidebarGroupContent className="flex flex-col gap-1.5 px-1">
          {/* Two-per-row grid (matching the mockup) rather than a stack of
              full-width rows — the command set is small and scannable at a glance. */}
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_COMMANDS.map((command) => (
              <Button
                key={command.id}
                variant="ghost"
                size="sm"
                className="glaze-chip justify-start gap-1.5 rounded-md font-mono text-xs font-normal"
                disabled={running !== null}
                onClick={() => run(command)}
              >
                {running === command.id ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <command.icon className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                {command.label}
              </Button>
            ))}
          </div>
          {result && <ResultCard result={result} onDismiss={() => setResult(null)} />}
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}
