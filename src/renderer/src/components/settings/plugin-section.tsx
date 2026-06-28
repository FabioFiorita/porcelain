import { Button } from '@renderer/components/ui/button'
import {
  useCursorPluginInfo,
  useInstallCursorPlugin,
  useInstallPlugin,
  usePluginInfo,
} from '@renderer/hooks/use-plugin'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { ArrowUpCircle, Check, CircleCheck, Copy, Loader2, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

type PluginTarget = 'claude' | 'cursor'

interface PluginSectionProps {
  target: PluginTarget
}

function usePluginSectionState(target: PluginTarget) {
  const claudeInfo = usePluginInfo()
  const cursorInfo = useCursorPluginInfo()
  const claudeInstall = useInstallPlugin()
  const cursorInstall = useInstallCursorPlugin()

  const pluginInstalled = usePreferencesStore((s) =>
    target === 'claude' ? s.pluginInstalled : s.cursorPluginInstalled,
  )
  const pluginVersion = usePreferencesStore((s) =>
    target === 'claude' ? s.pluginVersion : s.cursorPluginVersion,
  )
  const setPluginInstalled = usePreferencesStore((s) =>
    target === 'claude' ? s.setPluginInstalled : s.setCursorPluginInstalled,
  )
  const setPluginVersion = usePreferencesStore((s) =>
    target === 'claude' ? s.setPluginVersion : s.setCursorPluginVersion,
  )

  const info = target === 'claude' ? claudeInfo : cursorInfo
  const { install, isInstalling, result, error } =
    target === 'claude' ? claudeInstall : cursorInstall

  return {
    info,
    install,
    isInstalling,
    result,
    error,
    pluginInstalled,
    pluginVersion,
    setPluginInstalled,
    setPluginVersion,
  }
}

const TARGET_CONFIG: Record<
  PluginTarget,
  {
    installLabel: string
    reloadHint: string
    reloadAfter: string
    autoInstallFailure: string
    filesLabel: string
    filesPath: (info: { marketplaceDir?: string; installDir?: string }) => string | undefined
  }
> = {
  claude: {
    installLabel: 'Install for Claude Code',
    reloadHint: '/reload-plugins',
    reloadAfter: 'Run /reload-plugins (or restart the session) afterward.',
    autoInstallFailure:
      "Couldn't run the install automatically (is the claude CLI installed?). The plugin files are ready — run the commands below by hand.",
    filesLabel: 'Plugin written to',
    filesPath: (info) => info.marketplaceDir,
  },
  cursor: {
    installLabel: 'Install for Cursor',
    reloadHint: 'Developer: Reload Window',
    reloadAfter: 'Restart Cursor or run Developer: Reload Window afterward.',
    autoInstallFailure:
      "Couldn't copy the plugin into ~/.cursor/plugins/local automatically. The plugin files are ready — run the commands below by hand.",
    filesLabel: 'Plugin installed to',
    filesPath: (info) => info.installDir,
  },
}

export function PluginSection({ target }: PluginSectionProps): React.JSX.Element {
  const config = TARGET_CONFIG[target]
  const {
    info,
    install,
    isInstalling,
    result,
    error,
    pluginInstalled,
    pluginVersion,
    setPluginInstalled,
    setPluginVersion,
  } = usePluginSectionState(target)
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
    await navigator.clipboard.writeText(commands.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const filesPath = info ? config.filesPath(info) : undefined

  return (
    <div className="flex flex-col gap-5">
      {!pluginInstalled ? (
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => install()} disabled={isInstalling}>
            {isInstalling && <Loader2 className="animate-spin" />}
            {isInstalling ? 'Installing…' : config.installLabel}
          </Button>
          <p className="text-xs text-muted-foreground">{config.reloadAfter}</p>
        </div>
      ) : needsUpdate ? (
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => install()} disabled={isInstalling}>
            {isInstalling ? <Loader2 className="animate-spin" /> : <ArrowUpCircle />}
            {isInstalling ? 'Updating…' : current ? `Update to v${current}` : 'Update'}
          </Button>
          <p className="text-xs text-muted-foreground">
            A newer plugin is available{pluginVersion ? ` (you have v${pluginVersion})` : ''}. Run{' '}
            <code className="font-mono">{config.reloadHint}</code> after updating.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm-minus text-success">
            <CircleCheck className="size-4" /> Up to date{current ? ` · v${current}` : ''}
          </span>
          <Button variant="ghost" size="sm" onClick={() => install()} disabled={isInstalling}>
            {isInstalling && <Loader2 className="animate-spin" />}
            {isInstalling ? 'Reinstalling…' : 'Reinstall'}
          </Button>
          <span className="text-xs text-muted-foreground">
            Run <code className="font-mono">{config.reloadHint}</code> after reinstalling.
          </span>
        </div>
      )}

      {result?.ok && (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <Check className="size-3.5" /> Installed — run{' '}
          <code className="font-mono">{config.reloadHint}</code> to load the latest tools.
        </p>
      )}
      {(error || (result && !result.ok)) && (
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {config.autoInstallFailure}
        </p>
      )}
      {(result || error) && (
        <pre className="max-h-32 overflow-auto rounded-md bg-card p-2.5 font-mono text-xs-minus text-muted-foreground">
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
        <pre className="overflow-auto rounded-md bg-card p-2.5 font-mono text-xs-minus text-foreground/90">
          {commands.map((command) => (
            <div key={command}>{command}</div>
          ))}
        </pre>
        {filesPath && (
          <p className="mt-1.5 text-xs-minus text-muted-foreground/70">
            {config.filesLabel} <code className="font-mono">{filesPath}</code>
          </p>
        )}
      </div>
    </div>
  )
}
