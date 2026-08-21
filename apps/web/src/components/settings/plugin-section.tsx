import { Button } from '@renderer/components/ui/button'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { usePluginInfo } from '@renderer/hooks/use-plugin'
import { compactButtonClass } from '@renderer/lib/controls'
import { copyText } from '@renderer/lib/utils'
import { runUserAction } from '@shared/background'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

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

/**
 * The General "Companion" block owns the title and blurb so this doesn't re-introduce the
 * same-weight heading underneath. Agent Plugins leaves distribution to each client, so the
 * first option shows the repository source. Claude has an explicit marketplace route.
 */
export function PluginSection(): React.JSX.Element {
  const info = usePluginInfo()

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {info?.version != null && (
        <p className="text-xs text-muted-foreground">Bundled plugin: v{info.version}.</p>
      )}

      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-2xs font-medium tracking-wider text-muted-foreground uppercase">
          Agent Plugin
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
