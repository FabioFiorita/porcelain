import type { DevServer, DevServerTarget } from '@porcelain/contracts/terminal'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { useHubTarget } from '@renderer/stores/hub-selection'
import { useTerminalsStore } from '@renderer/stores/terminals'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { ExternalLink, Server } from 'lucide-react'
import { useState } from 'react'
import { devServerTargetOf, useDevServerCommands, useDevServers } from './dev-servers'

/**
 * The Servers section: what the daemon is still running for the selected Worktree.
 *
 * There is no "did my server survive?" question to answer here, which is the whole design —
 * the list is a read of daemon truth, so leaving and coming back simply shows it again. Stop
 * is the only control that ends anything, and it is always an explicit press.
 */

const rowClass =
  'flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-left hover:bg-accent/50'

const STATUS_LABEL: Record<DevServer['status'], string> = {
  starting: 'Starting',
  running: 'Running',
  exited: 'Exited',
  stopped: 'Stopped',
}

/**
 * Open a detected URL the way every other external link in the client does: `window.open`,
 * which in Electron reaches main's `setWindowOpenHandler` → `isSafeExternalUrl` →
 * `shell.openExternal`, and in the browser is just a tab. The scheme is re-checked here so a
 * server that printed something exotic cannot smuggle a non-http target into that handler.
 */
function openDetectedUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return
  window.open(parsed.toString(), '_blank', 'noopener,noreferrer')
}

/**
 * `stop`/`dismiss` are commands, not DOM events: they are named as verbs rather than `onX` so
 * nothing mistakes an async daemon command for a fire-and-forget event handler.
 */
function DevServerRow({
  server,
  stop,
  dismiss,
}: {
  server: DevServer
  stop: (server: DevServer) => Promise<void>
  dismiss: (server: DevServer) => Promise<void>
}): React.JSX.Element {
  const openPanel = useTerminalsStore((state) => state.openPanel)
  const live = server.status === 'starting' || server.status === 'running'

  return (
    <div
      className={rowClass}
      data-testid={TestIds.devServerRow(server.id)}
      data-status={server.status}
    >
      <Server className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{server.label}</span>
        <span className="block truncate font-mono text-2xs text-muted-foreground/70">
          {server.command}
        </span>
      </span>
      {server.detectedUrl !== undefined && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid={TestIds.devServerUrl(server.id)}
          onClick={() => openDetectedUrl(server.detectedUrl ?? '')}
        >
          <ExternalLink className="size-3" />
          <span className="max-w-40 truncate font-mono text-2xs">{server.detectedUrl}</span>
        </Button>
      )}
      <span className="shrink-0 text-2xs text-muted-foreground/60">
        {STATUS_LABEL[server.status]}
        {server.exitCode !== undefined && ` (${server.exitCode})`}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-testid={TestIds.devServerAttach(server.id)}
        onClick={() => openPanel(server.terminalId)}
      >
        Output
      </Button>
      {live ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid={TestIds.devServerStop(server.id)}
          onClick={() =>
            runUserAction(
              () => stop(server),
              (error) => toastUserActionError('Stop server', error),
            )
          }
        >
          Stop
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid={TestIds.devServerDismiss(server.id)}
          onClick={() =>
            runUserAction(
              () => dismiss(server),
              (error) => toastUserActionError('Dismiss server', error),
            )
          }
        >
          Dismiss
        </Button>
      )}
    </div>
  )
}

function StartDevServerForm({
  target,
  start,
}: {
  target: DevServerTarget
  start: (input: { target: DevServerTarget; label: string; command: string }) => Promise<void>
}): React.JSX.Element {
  const [label, setLabel] = useState('')
  const [command, setCommand] = useState('')
  const ready = label.trim() !== '' && command.trim() !== ''

  const handleStart = (): void => {
    if (!ready) return
    const input = { target, label: label.trim(), command: command.trim() }
    setLabel('')
    setCommand('')
    runUserAction(
      () => start(input),
      (error) => toastUserActionError('Start server', error),
    )
  }

  return (
    <div className="flex items-center gap-2 px-2 pt-1" data-testid={TestIds.devServerNew}>
      <Input
        aria-label="Server name"
        placeholder="web"
        className="h-8 w-28"
        data-testid={TestIds.devServerLabelInput}
        value={label}
        onChange={(event) => setLabel(event.target.value)}
      />
      <Input
        aria-label="Server command"
        placeholder="pnpm dev"
        className="h-8 flex-1 font-mono text-xs"
        data-testid={TestIds.devServerCommandInput}
        value={command}
        onChange={(event) => setCommand(event.target.value)}
      />
      <Button
        type="button"
        size="sm"
        disabled={!ready}
        data-testid={TestIds.devServerSubmit}
        onClick={handleStart}
      >
        Start
      </Button>
    </div>
  )
}

/**
 * Rendered for the selected Worktree. Without a Worktree there is no target, and a server
 * without an explicit target is exactly what this feature refuses to create — so the section
 * renders nothing rather than offering a control that would have to guess.
 */
export function DevServersSection(): React.JSX.Element | null {
  const target = useHubTarget()
  const { servers, loaded } = useDevServers(target)
  const { start, stop, dismiss } = useDevServerCommands()

  if (target === null) return null

  return (
    <section className="flex flex-col gap-0.5" data-testid={TestIds.devServers}>
      <p className="px-2 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Servers
      </p>
      {servers.map((server) => (
        <DevServerRow key={server.id} server={server} stop={stop} dismiss={dismiss} />
      ))}
      {loaded && servers.length === 0 && (
        <p
          data-testid={TestIds.devServersEmpty}
          className="px-2 py-1 text-xs text-muted-foreground"
        >
          Nothing running here. A server started below keeps running while you work elsewhere.
        </p>
      )}
      <StartDevServerForm target={devServerTargetOf(target)} start={start} />
    </section>
  )
}
