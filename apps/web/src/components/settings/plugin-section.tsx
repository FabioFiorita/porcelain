import { Button } from '@renderer/components/ui/button'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { useCodexPluginStatus, usePluginInfo } from '@renderer/hooks/use-plugin'
import { compactButtonClass } from '@renderer/lib/controls'
import { shellTrpc } from '@renderer/lib/trpc'
import { copyText } from '@renderer/lib/utils'
import { runUserAction } from '@shared/background'
import { Check, Copy, Loader2, Plug, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

/** One copyable block for a client-specific installation route or repository source. */
function CopyBlock({ label, lines }: { label: string; lines: readonly string[] }) {
  const [copied, setCopied] = useState(false)
  const text = lines.join('\n')

  const handleCopy = (): void => {
    runUserAction(
      async () => {
        await copyText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      (error) => {
        toastUserActionError('Copy plugin details', error)
      },
    )
  }

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-2xs font-medium tracking-wider text-muted-foreground uppercase">
          {label}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className={compactButtonClass}
          onClick={handleCopy}
          disabled={text.length === 0}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="max-w-full overflow-auto rounded-md bg-card p-2.5 font-mono text-xs-minus text-foreground/90">
        {text}
      </pre>
    </div>
  )
}

/** Install Porcelain into Codex, with manual sources for other plugin-capable agents. */
export function PluginSection(): React.JSX.Element {
  const info = usePluginInfo()
  const status = useCodexPluginStatus()
  const install = shellTrpc.installCodexPlugin.useMutation()
  const utils = shellTrpc.useUtils()
  const installed = status.data?.state === 'installed'
  const unavailable = status.data?.state === 'unavailable'

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {info?.version != null && (
        <p className="text-xs text-muted-foreground">Bundled plugin: v{info.version}.</p>
      )}

      <div className="flex items-center justify-between gap-4 rounded-md border bg-card p-3">
        <div className="min-w-0">
          <p className="text-sm-minus font-medium">Codex</p>
          <p className="text-xs text-muted-foreground">
            {installed
              ? `Installed${status.data?.version ? ` · v${status.data.version}` : ''}${status.data?.enabled === false ? ' · disabled' : ''}. Reinstall from the latest marketplace snapshot.`
              : 'Add the plugin to Codex on this machine. Restart Codex before opening a new task.'}
          </p>
        </div>
        <Button
          size="sm"
          className={compactButtonClass}
          disabled={install.isPending || status.isLoading || unavailable}
          onClick={() =>
            install.mutate(undefined, {
              onSuccess: async () => {
                await utils.codexPluginStatus.invalidate()
                toast.success(
                  installed
                    ? 'Porcelain was reinstalled in Codex.'
                    : 'Porcelain was added to Codex.',
                )
              },
              onError: (error) => toastUserActionError('Add Porcelain to Codex', error),
            })
          }
        >
          {install.isPending ? <Loader2 className="animate-spin" /> : <Plug />}
          {install.isPending
            ? installed
              ? 'Reinstalling…'
              : 'Adding…'
            : installed
              ? 'Reinstall'
              : 'Add to Codex'}
        </Button>
      </div>

      {unavailable && (
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {status.data?.error ?? 'Codex plugin status is unavailable.'}
        </p>
      )}

      {install.isSuccess && (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <Check className="size-3.5" /> {installed ? 'Reinstalled' : 'Added'}. Restart Codex before
          opening a new task.
        </p>
      )}

      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-2xs font-medium tracking-wider text-muted-foreground uppercase">
          Other agents
        </p>
        <p className="text-xs text-muted-foreground">
          Use your agent's native plugin manager with this repository:
        </p>
        <CopyBlock label="Repository" lines={info ? [info.agentPluginRepository] : []} />
      </div>
      <CopyBlock label="Claude Plugin" lines={info?.claudePluginCommands ?? []} />
    </div>
  )
}
