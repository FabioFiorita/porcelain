import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Separator } from '@renderer/components/ui/separator'
import { Switch } from '@renderer/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useDaemonToken } from '@renderer/hooks/use-daemon-token'
import { useLanStatus, useSetLanBind } from '@renderer/hooks/use-lan'
import {
  useAddRemoteEnvironment,
  useConnectRemoteEnvironment,
  useDisconnectRemoteEnvironment,
  useOpenWindowInEnvironment,
  useRemoteEnvironments,
  useRemoveRemoteEnvironment,
} from '@renderer/hooks/use-remote-daemon'
import { useSetTailnetBind, useTailnetStatus } from '@renderer/hooks/use-tailnet'
import { isBrowser } from '@renderer/lib/platform'
import { copyText } from '@renderer/lib/utils'
import { X } from 'lucide-react'
import { useState } from 'react'

/** Copy the daemon token to the clipboard — the affordance a peer needs to connect. */
function CopyTokenButton(): React.JSX.Element {
  const daemonToken = useDaemonToken()
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        // copyText, not navigator.clipboard directly: the daemon-served browser
        // client (the LAN/tailnet peer that reaches this very block) is an insecure
        // context where navigator.clipboard is undefined — copyText falls back to
        // the execCommand path there. See the architecture skill's insecure-context trap.
        await copyText(daemonToken)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? 'Copied' : 'Copy token'}
    </Button>
  )
}

/**
 * The reveal shown once a second listener is up: the reachable url(s), a copy-token
 * button, and the token-path hint. Shared by the Tailscale and LAN blocks — the LAN
 * passes a `numericUrl` fallback alongside its `.local` name.
 */
function ShareReveal({
  url,
  numericUrl,
}: {
  url: string
  numericUrl?: string | null
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="font-mono text-xs text-muted-foreground">{url}</p>
        <CopyTokenButton />
      </div>
      {numericUrl != null && numericUrl !== url && (
        <p className="font-mono text-xs text-muted-foreground">{numericUrl}</p>
      )}
      <p className="text-xs text-muted-foreground">
        The token lives at <span className="font-mono">~/.porcelain/daemon-token</span>.
      </p>
    </div>
  )
}

function ShareToggleRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
  envForcedLabel,
  url,
  numericUrl,
  emptyHint,
}: {
  label: string
  description: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
  envForcedLabel?: string
  url: string | null | undefined
  numericUrl?: string | null
  emptyHint: string
}): React.JSX.Element {
  // Nested under a section heading — labels stay medium (not semibold) so the
  // group title is the only bold step at this size.
  return (
    <div className="flex flex-col gap-2 px-3 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm-minus font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          className="shrink-0"
        />
      </div>
      {envForcedLabel != null && <p className="text-xs text-muted-foreground">{envForcedLabel}</p>}
      {url != null && <ShareReveal url={url} numericUrl={numericUrl} />}
      {checked && url == null && <p className="text-xs text-muted-foreground">{emptyHint}</p>}
    </div>
  )
}

/**
 * Save other machines' Porcelain daemons and bind THIS window (or open a new
 * one) to them. Environments are per-window: local project in one window, remote
 * in another. Electron-only — hidden in the browser client (which already IS
 * served by its daemon). Adding probes the url+token and surfaces a failure
 * inline. Connect / disconnect / remove-when-this-window reloads THIS window
 * only (see use-remote-daemon).
 */
function SavedEnvironmentsBlock(): React.JSX.Element {
  const data = useRemoteEnvironments()
  const { add, isPending: isAdding, error } = useAddRemoteEnvironment()
  const { connect, pendingId: connectingId } = useConnectRemoteEnvironment()
  const { disconnect, isPending: isDisconnecting } = useDisconnectRemoteEnvironment()
  const { open: openInEnv } = useOpenWindowInEnvironment()
  const { remove, pendingId: removingId } = useRemoveRemoteEnvironment()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const environments = data?.environments ?? []
  const activeId = data?.activeId ?? null

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Saved environments</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Each window can use a different daemon — local project in one, remote in another. Use here
          reloads this window; New window opens a fresh one on that environment.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        <li className="flex items-center justify-between gap-3 rounded-md bg-card p-3">
          <div className="min-w-0">
            <p className="text-sm-minus font-medium">This device</p>
            <p className="text-xs text-muted-foreground">Local daemon on this Mac</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {activeId == null ? (
              <span className="text-xs text-muted-foreground">This window</span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={isDisconnecting}
                onClick={() => disconnect()}
              >
                {isDisconnecting ? 'Switching…' : 'Use here'}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => openInEnv({ environmentId: null })}>
              New window
            </Button>
          </div>
        </li>
        {environments.map((env) => {
          const isActive = env.id === activeId
          return (
            <li
              key={env.id}
              className="flex items-center justify-between gap-3 rounded-md bg-card p-3"
            >
              <div className="min-w-0">
                <p className="text-sm-minus font-medium">{env.name}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{env.url}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isActive ? (
                  <span className="text-xs text-muted-foreground">This window</span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={connectingId === env.id}
                    onClick={() => connect(env.id)}
                  >
                    {connectingId === env.id ? 'Switching…' : 'Use here'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openInEnv({ environmentId: env.id })}
                >
                  New window
                </Button>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={removingId === env.id}
                        onClick={() => remove(env.id)}
                        aria-label="Remove"
                      >
                        <X />
                      </Button>
                    }
                  />
                  <TooltipContent>Remove</TooltipContent>
                </Tooltip>
              </div>
            </li>
          )
        })}
      </ul>

      {showAdd ? (
        <div className="flex flex-col gap-2 rounded-md border border-border/60 p-3">
          <p className="text-2xs font-medium tracking-wider text-muted-foreground uppercase">
            Add environment
          </p>
          <Input
            placeholder="Name (e.g. Beelink)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isAdding}
          />
          <Input
            placeholder="URL (e.g. http://beelink.tailnet.ts.net:43117)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isAdding}
          />
          <Input
            type="password"
            placeholder="Daemon token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={isAdding}
          />
          <p className="text-xs text-muted-foreground">
            On the other machine, copy it from Settings → Environments → Share, or run{' '}
            <span className="font-mono">cat ~/.porcelain/daemon-token</span>.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              disabled={isAdding || url.trim() === '' || token.trim() === ''}
              onClick={() => add({ name, url, token })}
            >
              {isAdding ? 'Adding…' : 'Add & use here'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={isAdding}
              onClick={() => {
                setShowAdd(false)
                setName('')
                setUrl('')
                setToken('')
              }}
            >
              Cancel
            </Button>
          </div>
          {error != null && <p className="text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setShowAdd(true)}>
          Add environment
        </Button>
      )}
    </div>
  )
}

/**
 * Share this daemon + bind windows to saved remote daemons. Split out of General
 * so viewer prefs stay short and environment work has a clear home.
 */
export function EnvironmentsSection(): React.JSX.Element {
  const tailnet = useTailnetStatus()
  const { setEnabled: setTailnetEnabled } = useSetTailnetBind()
  const lan = useLanStatus()
  const { setEnabled: setLanEnabled } = useSetLanBind()

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        {/* Group title one step above the control labels (sm + semibold vs sm-minus + medium). */}
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Share this device</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Let other devices reach this daemon over Tailscale or your LAN. Always token-gated.
          </p>
        </div>
        <div className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
          <ShareToggleRow
            label="Share over Tailscale"
            description="Other devices on your tailnet — WireGuard-encrypted."
            checked={tailnet?.enabled ?? false}
            disabled={tailnet?.envForced ?? false}
            onCheckedChange={(checked) => setTailnetEnabled(checked)}
            envForcedLabel={
              tailnet?.envForced === true ? 'Enabled via PORCELAIN_TAILNET_BIND (env)' : undefined
            }
            url={tailnet?.url}
            emptyHint={
              tailnet?.error === 'in-use'
                ? 'Port 43117 is in use — another daemon may still be running.'
                : 'No Tailscale interface found'
            }
          />
          <ShareToggleRow
            label="Share on local network"
            description="Same Wi-Fi / LAN — token-gated, traffic is unencrypted on the wire."
            checked={lan?.enabled ?? false}
            disabled={lan?.envForced ?? false}
            onCheckedChange={(checked) => setLanEnabled(checked)}
            envForcedLabel={lan?.envForced === true ? 'Enabled via PORCELAIN_LAN_BIND' : undefined}
            url={lan?.url}
            numericUrl={lan?.numericUrl}
            emptyHint={
              lan?.error === 'in-use'
                ? 'Port 43117 is in use — another daemon may still be running.'
                : 'No local network interface found'
            }
          />
        </div>
      </section>

      {!isBrowser && (
        <>
          <Separator />
          <SavedEnvironmentsBlock />
        </>
      )}
    </div>
  )
}
