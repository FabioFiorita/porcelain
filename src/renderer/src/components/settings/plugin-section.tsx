import { Button } from '@renderer/components/ui/button'
import { useInstallPlugin, usePluginInfo } from '@renderer/hooks/use-plugin'
import { Check, Copy, Loader2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

export function PluginSection(): React.JSX.Element {
  const info = usePluginInfo()
  const { install, isInstalling, result, error } = useInstallPlugin()
  const [copied, setCopied] = useState(false)

  const commands = info?.commands ?? []

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(commands.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-medium">Claude Code plugin</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Installs the Porcelain plugin for Claude Code — bundles the MCP server and a skill that
          teaches your agent to push the whole feature (server + cross-seam files, with notes) into
          the feature view, not just the diff.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => install()} disabled={isInstalling}>
          {isInstalling && <Loader2 className="animate-spin" />}
          {isInstalling ? 'Installing…' : 'Install for Claude Code'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Run <code className="font-mono">/reload-plugins</code> (or restart the session) afterward.
        </p>
      </div>

      {result?.ok && (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <Check className="size-3.5" /> Installed. Your agent can now push feature reviews.
        </p>
      )}
      {(error || (result && !result.ok)) && (
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          Couldn't run the install automatically (is the{' '}
          <code className="mx-1 font-mono">claude</code> CLI installed?). The plugin files are ready
          — run the commands below by hand.
        </p>
      )}
      {(result || error) && (
        <pre className="max-h-32 overflow-auto rounded-md bg-card p-2.5 font-mono text-[11px] text-muted-foreground">
          {error ?? result?.output}
        </pre>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-medium">Install manually</p>
          <Button variant="ghost" size="sm" onClick={() => copy()} disabled={commands.length === 0}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <pre className="overflow-auto rounded-md bg-card p-2.5 font-mono text-[11px] text-foreground/90">
          {commands.map((command) => (
            <div key={command}>{command}</div>
          ))}
        </pre>
        {info && (
          <p className="mt-1.5 text-[11px] text-muted-foreground/70">
            Plugin written to <code className="font-mono">{info.marketplaceDir}</code>
          </p>
        )}
      </div>
    </div>
  )
}
