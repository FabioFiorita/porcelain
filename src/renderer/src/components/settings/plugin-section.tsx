import { Button } from '@renderer/components/ui/button'
import { useInstallPlugin, usePluginInfo } from '@renderer/hooks/use-plugin'
import { copyText } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { ArrowUpCircle, Check, CircleCheck, Copy, Loader2, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

export function PluginSection(): React.JSX.Element {
  const info = usePluginInfo()
  const { install, isInstalling, result, error } = useInstallPlugin()
  const pluginInstalled = usePreferencesStore((s) => s.pluginInstalled)
  const pluginVersion = usePreferencesStore((s) => s.pluginVersion)
  const setPluginInstalled = usePreferencesStore((s) => s.setPluginInstalled)
  const setPluginVersion = usePreferencesStore((s) => s.setPluginVersion)
  const [copied, setCopied] = useState(false)

  const current = info?.version
  const needsUpdate = pluginInstalled && current !== undefined && pluginVersion !== current

  useEffect(() => {
    if (!result?.ok) return
    setPluginInstalled(true)
    if (current) setPluginVersion(current)
  }, [result, current, setPluginInstalled, setPluginVersion])

  const commands = info?.commands ?? []

  const copy = async (): Promise<void> => {
    await copyText(commands.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {!pluginInstalled ? (
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => install()} disabled={isInstalling}>
            {isInstalling && <Loader2 className="animate-spin" />}
            {isInstalling ? 'Installing…' : 'Install for Claude Code'}
          </Button>
          <p className="min-w-0 text-xs text-muted-foreground">
            Run /reload-plugins (or restart the session) afterward.
          </p>
        </div>
      ) : needsUpdate ? (
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => install()} disabled={isInstalling}>
            {isInstalling ? <Loader2 className="animate-spin" /> : <ArrowUpCircle />}
            {isInstalling ? 'Updating…' : current ? `Update to v${current}` : 'Update'}
          </Button>
          <p className="min-w-0 text-xs text-muted-foreground">
            A newer plugin is available{pluginVersion ? ` (you have v${pluginVersion})` : ''}. Run{' '}
            <code className="font-mono">/reload-plugins</code> after updating.
          </p>
        </div>
      ) : (
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm-minus text-success">
            <CircleCheck className="size-4" /> Up to date{current ? ` · v${current}` : ''}
          </span>
          <Button variant="ghost" size="sm" onClick={() => install()} disabled={isInstalling}>
            {isInstalling && <Loader2 className="animate-spin" />}
            {isInstalling ? 'Reinstalling…' : 'Reinstall'}
          </Button>
          <span className="min-w-0 text-xs text-muted-foreground">
            Run <code className="font-mono">/reload-plugins</code> after reinstalling.
          </span>
        </div>
      )}

      {result?.ok && (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <Check className="size-3.5" /> Installed — run{' '}
          <code className="font-mono">/reload-plugins</code> to load the latest tools.
        </p>
      )}
      {(error || (result && !result.ok)) && (
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          Couldn't run the install automatically (is the claude CLI installed?). The plugin files
          are ready — run the commands below by hand.
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
        {info?.marketplaceDir && (
          <p className="mt-1.5 min-w-0 break-all text-xs-minus text-muted-foreground/70">
            Plugin written to <code className="font-mono">{info.marketplaceDir}</code>
          </p>
        )}
      </div>
    </div>
  )
}
