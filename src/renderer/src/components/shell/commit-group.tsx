import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@renderer/components/ui/sidebar'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { useCommit, useCommitConventions, useStageAll } from '@renderer/hooks/use-commit'
import { cn } from '@renderer/lib/utils'
import { FilePlus2, GitCommitHorizontal } from 'lucide-react'
import { useState } from 'react'

export function CommitGroup(): React.JSX.Element {
  const [type, setType] = useState<string | null>(null)
  const [scope, setScope] = useState<string | null>(null)
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

  const prefix = type ? `${type}${scope ? `(${scope})` : ''}: ` : ''
  const subject = `${prefix}${message.trim()}`
  const ready = type !== null && message.trim() !== ''

  const commit = (): void => {
    if (!ready || isCommitting) return
    runCommit(subject)
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
        <div className="flex flex-col gap-2.5 rounded-md border border-border/60 bg-card p-2.5">
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
            className="h-8 text-sm"
          />
          {prefix && (
            <p className="truncate font-mono text-[11px] text-muted-foreground">{subject}</p>
          )}
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
            <Button size="sm" variant="outline" disabled={isStaging} onClick={stage}>
              <FilePlus2 />
              {isStaging ? 'Staging…' : 'Stage all'}
            </Button>
            <Button size="sm" disabled={!ready || isCommitting} onClick={commit}>
              <GitCommitHorizontal />
              {isCommitting ? 'Committing…' : 'Commit'}
            </Button>
          </div>
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
