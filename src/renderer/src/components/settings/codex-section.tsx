import { Button } from '@renderer/components/ui/button'
import { useCodexInfo, useInstallCodex } from '@renderer/hooks/use-codex'
import { Check, CircleCheck, Copy, Loader2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

export function CodexSection(): React.JSX.Element {
  const info = useCodexInfo()
  const { install, isInstalling, result, error } = useInstallCodex()
  const [copied, setCopied] = useState(false)
  const commands = info?.commands ?? []

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(commands.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => install()} disabled={isInstalling}>
          {isInstalling && <Loader2 className="animate-spin" />}
          {isInstalling ? 'Installing…' : result?.ok ? 'Reinstall for Codex' : 'Install for Codex'}
        </Button>
        <p className="min-w-0 text-xs text-muted-foreground">
          Start a new Codex thread after installing so the plugin loads.
        </p>
      </div>

      {result?.ok && (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <CircleCheck className="size-3.5" /> Installed — start a new Codex thread to load the
          plugin.
        </p>
      )}
      {(error || (result && !result.ok)) && (
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          Couldn't run the install automatically (is the{' '}
          <code className="mx-1 font-mono">codex</code> CLI installed?). The plugin files are ready
          — run the commands below by hand.
        </p>
      )}
      {(result || error) && (
        <pre className="max-h-32 max-w-full overflow-auto rounded-md bg-card p-2.5 font-mono text-xs-minus text-muted-foreground">
          {error ?? result?.output}
        </pre>
      )}

      <div className="min-w-0">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Install manually
          </p>
          <Button variant="ghost" size="sm" onClick={() => copy()} disabled={commands.length === 0}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <pre className="max-w-full overflow-auto rounded-md bg-card p-2.5 font-mono text-xs-minus text-foreground/90">
          {commands.map((command) => (
            <div key={command}>{command}</div>
          ))}
        </pre>
        {info && (
          <p className="mt-1.5 min-w-0 break-all text-xs-minus text-muted-foreground/70">
            Plugin written to <code className="font-mono">{info.marketplaceDir}</code>
          </p>
        )}
      </div>
    </div>
  )
}
