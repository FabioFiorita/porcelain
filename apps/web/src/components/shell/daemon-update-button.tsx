import { Button } from '@renderer/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@renderer/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useDaemonUpdatePrompt } from '@renderer/hooks/use-daemon-update-prompt'
import {
  DAEMON_UPDATE_DOCS_URL,
  DAEMON_UPDATE_FOREGROUND_COMMAND,
  DAEMON_UPDATE_SYSTEMD_COMMAND,
} from '@renderer/lib/daemon-update'
import { cn, copyText } from '@renderer/lib/utils'
import { settleBackground } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { CloudDownload, Copy } from 'lucide-react'
import { useState } from 'react'

/**
 * Sibling of `UpdateButton`, same chip in the same sidebar header — but about the daemon on
 * the OTHER end of this window's connection, not the app in front of you.
 *
 * It is a separate component rather than a branch inside `UpdateButton` because the two have
 * opposite runtime rules: `UpdateButton` is Electron-only (a browser tab has no auto-updater)
 * and can install with one click, while this one appears in both runtimes and can only hand
 * over a command — the daemon exposes no self-update procedure, and updating a host is the
 * host administrator's action.
 *
 * Icon-only on purpose: unlike `UpdateButton` (rare, and gone the moment you click it) this
 * one sits in the header until the host is actually updated, and a labelled chip truncated
 * the "Porcelain" title beside it at the sidebar's minimum width. The label lives in the
 * tooltip and the accessible name.
 *
 * Only ever visible when the protocol still matches: a daemon too old to speak this
 * protocol is refused by the session gate long before a chip could render (`update-required`
 * in features/remote/remote-session.ts).
 */
export function DaemonUpdateButton(): React.JSX.Element | null {
  const prompt = useDaemonUpdatePrompt()
  const [copied, setCopied] = useState(false)

  if (prompt === null) return null

  // Name the host and BOTH versions. "Update remote daemon (0.56.0)" read as an offer to
  // install 0.56.0 — it is the version the daemon is stuck on, and the number that makes
  // that legible is the one beside it.
  const label = `Update ${prompt.daemonName} — running ${prompt.daemonVersion}, this app is ${prompt.clientVersion}`
  const copy = (command: string): void => {
    settleBackground(
      copyText(command).then(() => {
        setCopied(true)
      }),
      'fallback',
    )
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <button
                  type="button"
                  data-testid={TestIds.daemonUpdateButton}
                  aria-label={label}
                  className={cn(
                    'app-no-drag flex size-8 shrink-0 items-center justify-center rounded-md',
                    'border border-border bg-secondary text-secondary-foreground transition-colors',
                    'hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  )}
                >
                  <CloudDownload className="size-3.5 shrink-0 opacity-80" aria-hidden />
                </button>
              }
            />
          }
        />
        <TooltipContent side="bottom" align="end">
          {label}
        </TooltipContent>
      </Tooltip>
      <PopoverContent side="bottom" align="end" className="w-80 gap-3">
        <PopoverHeader>
          <PopoverTitle>Remote daemon is out of date</PopoverTitle>
          <PopoverDescription>
            {prompt.daemonName} runs Porcelain {prompt.daemonVersion}; this client is{' '}
            {prompt.clientVersion}. Update it on the host.
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-col gap-1">
          <code
            data-testid={TestIds.daemonUpdateCommand}
            className="rounded-md bg-muted px-2 py-1.5 font-mono text-xs break-words"
          >
            {DAEMON_UPDATE_SYSTEMD_COMMAND}
          </code>
          <p className="text-xs text-muted-foreground">
            The always-on unit re-resolves{' '}
            <code className="font-mono">porcelain-daemon@latest</code> on start, so a restart is the
            upgrade. Started by hand instead? Stop it and re-run{' '}
            <code className="font-mono">{DAEMON_UPDATE_FOREGROUND_COMMAND}</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            data-testid={TestIds.daemonUpdateCopy}
            onClick={() => copy(DAEMON_UPDATE_SYSTEMD_COMMAND)}
          >
            <Copy /> {copied ? 'Copied' : 'Copy command'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid={TestIds.daemonUpdateDismiss}
            onClick={() => prompt.dismiss()}
          >
            Dismiss
          </Button>
        </div>
        <a
          href={DAEMON_UPDATE_DOCS_URL}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Remote access docs
        </a>
      </PopoverContent>
    </Popover>
  )
}
