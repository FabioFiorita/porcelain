import { Button } from '@renderer/components/ui/button'
import { useInstallPlugin, usePluginInfo } from '@renderer/hooks/use-plugin'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { ArrowUpCircle, Check, CircleCheck, Copy, Loader2, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

export function PluginSection(): React.JSX.Element {
  const info = usePluginInfo()
  const { install, isInstalling, result, error } = useInstallPlugin()
  const [copied, setCopied] = useState(false)
  const pluginInstalled = usePreferencesStore((s) => s.pluginInstalled)
  const setPluginInstalled = usePreferencesStore((s) => s.setPluginInstalled)
  const pluginVersion = usePreferencesStore((s) => s.pluginVersion)
  const setPluginVersion = usePreferencesStore((s) => s.setPluginVersion)

  const current = info?.version
  // Installed but the bundled plugin is a different version (or we never recorded one,
  // i.e. it was installed before versioning existed) → offer an update.
  const needsUpdate = pluginInstalled && current !== undefined && pluginVersion !== current

  // Record a successful install/update: the CTA then reflects "up to date".
  useEffect(() => {
    if (!result?.ok) return
    setPluginInstalled(true)
    if (current) setPluginVersion(current)
  }, [result, current, setPluginInstalled, setPluginVersion])

  const commands = info?.commands ?? []

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(commands.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col gap-5">
      {!pluginInstalled ? (
        <div className="flex items-center gap-3">
          <Button onClick={() => install()} disabled={isInstalling}>
            {isInstalling && <Loader2 className="animate-spin" />}
            {isInstalling ? 'Installing…' : 'Install for Claude Code'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Run <code className="font-mono">/reload-plugins</code> (or restart the session)
            afterward.
          </p>
        </div>
      ) : needsUpdate ? (
        <div className="flex items-center gap-3">
          <Button onClick={() => install()} disabled={isInstalling}>
            {isInstalling ? <Loader2 className="animate-spin" /> : <ArrowUpCircle />}
            {isInstalling ? 'Updating…' : current ? `Update to v${current}` : 'Update'}
          </Button>
          <p className="text-xs text-muted-foreground">
            A newer plugin is available{pluginVersion ? ` (you have v${pluginVersion})` : ''}. Run{' '}
            <code className="font-mono">/reload-plugins</code> after updating.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-success">
            <CircleCheck className="size-4" /> Up to date{current ? ` · v${current}` : ''}
          </span>
          <Button variant="ghost" size="sm" onClick={() => install()} disabled={isInstalling}>
            {isInstalling && <Loader2 className="animate-spin" />}
            {isInstalling ? 'Reinstalling…' : 'Reinstall'}
          </Button>
          <span className="text-xs text-muted-foreground">
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
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Install manually
          </p>
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
