import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { useFunnelStatus, useSetFunnelBind } from '@renderer/hooks/use-funnel'
import { useLanStatus, useSetLanBind } from '@renderer/hooks/use-lan'
import {
  useAccessStatus,
  useIssuePairingLink,
  useRevokeAuthorizedClient,
  useRevokePairingLink,
} from '@renderer/hooks/use-share'
import { useSetTailnetBind, useTailnetStatus } from '@renderer/hooks/use-tailnet'
import { compactButtonClass, rowActionClass } from '@renderer/lib/controls'
import { copyText } from '@renderer/lib/utils'
import { TestIds } from '@shared/test-ids'
import { useState } from 'react'

type ShareEndpoint = { label: string; url: string }

function ShareToggleRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
  envForcedHint,
  url,
  numericUrl,
  emptyHint,
}: {
  label: string
  description: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
  envForcedHint?: string
  url: string | null | undefined
  numericUrl?: string | null
  emptyHint: string
}): React.JSX.Element {
  const connectUrl =
    numericUrl != null && numericUrl !== '' && numericUrl !== url ? numericUrl : (url ?? null)

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
      {envForcedHint != null && <p className="text-xs text-muted-foreground">{envForcedHint}</p>}
      {connectUrl != null && (
        <p className="truncate font-mono text-xs text-muted-foreground">{connectUrl}</p>
      )}
      {checked && connectUrl == null && (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      )}
    </div>
  )
}

function PairDevice({ endpoints }: { endpoints: ShareEndpoint[] }): React.JSX.Element {
  const [label, setLabel] = useState('')
  const [createdUrl, setCreatedUrl] = useState('')
  const { issue, isPending } = useIssuePairingLink()

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Pair a device</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Create a one-time link. It expires in 15 minutes and can be used once.
        </p>
      </div>
      <div className="flex flex-col gap-2 rounded-md border border-border/60 p-3">
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Device name, e.g. My iPhone"
          maxLength={80}
          disabled={isPending}
        />
        <div className="flex flex-wrap gap-2">
          {endpoints.map((endpoint) => (
            <Button
              key={`${endpoint.label}:${endpoint.url}`}
              variant="outline"
              size="sm"
              className={compactButtonClass}
              disabled={isPending || label.trim() === ''}
              onClick={async () => {
                try {
                  const result = await issue({ label, baseUrl: endpoint.url })
                  setCreatedUrl(result.url)
                  await copyText(result.url)
                } catch {
                  // The mutation's shared error handler already explains the failure.
                }
              }}
            >
              {isPending ? 'Creating…' : `Create ${endpoint.label} link`}
            </Button>
          ))}
        </div>
        {endpoints.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Turn on a reachable network before creating a link.
          </p>
        )}
        {createdUrl !== '' && (
          <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/50 p-2">
            <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
              {createdUrl}
            </p>
            <Button
              variant="outline"
              size="sm"
              className={rowActionClass}
              onClick={async () => copyText(createdUrl)}
            >
              Copy
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

function AccessList(): React.JSX.Element {
  const status = useAccessStatus()
  const pairingRevoke = useRevokePairingLink()
  const clientRevoke = useRevokeAuthorizedClient()
  const clients = status?.clients ?? []
  const pairings = status?.pairings ?? []

  return (
    <section className="flex flex-col gap-3" data-testid={TestIds.shareStatus}>
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Access</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Each paired device has its own credential. Revoking one leaves every other device alone.
        </p>
      </div>
      <div className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
        {clients.map((client) => (
          <div key={client.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm-minus font-medium">{client.label}</p>
              <p className="text-xs text-muted-foreground">
                Paired {new Date(client.createdAt).toLocaleString()}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className={rowActionClass}
              disabled={clientRevoke.pendingId === client.id}
              onClick={() => clientRevoke.revoke(client.id)}
            >
              Revoke
            </Button>
          </div>
        ))}
        {pairings.map((pairing) => (
          <div key={pairing.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm-minus font-medium">{pairing.label}</p>
                <Badge variant="outline">Pending</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Expires {new Date(pairing.expiresAt).toLocaleString()}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className={rowActionClass}
              disabled={pairingRevoke.pendingId === pairing.id}
              onClick={() => pairingRevoke.revoke(pairing.id)}
            >
              Revoke
            </Button>
          </div>
        ))}
        {clients.length === 0 && pairings.length === 0 && (
          <p className="p-3 text-xs text-muted-foreground">No paired devices yet.</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {status?.connected ?? 0} live {status?.connected === 1 ? 'connection' : 'connections'}.
        Administration stays on this host.
      </p>
    </section>
  )
}

export function ShareSection(): React.JSX.Element {
  const tailnet = useTailnetStatus()
  const { setEnabled: setTailnetEnabled } = useSetTailnetBind()
  const lan = useLanStatus()
  const { setEnabled: setLanEnabled } = useSetLanBind()
  const funnel = useFunnelStatus()
  const { setEnabled: setFunnelEnabled, isPending: funnelPending } = useSetFunnelBind()

  const lanUrl =
    lan?.numericUrl != null && lan.numericUrl !== '' ? lan.numericUrl : (lan?.url ?? null)
  const endpoints: ShareEndpoint[] = [
    ...(lanUrl == null ? [] : [{ label: 'local network', url: lanUrl }]),
    ...(tailnet?.url == null ? [] : [{ label: 'Tailscale', url: tailnet.url }]),
    ...(funnel?.url == null ? [] : [{ label: 'Internet', url: funnel.url }]),
  ]

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Networks</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Choose where devices can reach this local daemon.
          </p>
        </div>
        <div className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
          <ShareToggleRow
            label="Local network"
            description="Same Wi‑Fi or LAN. Traffic is not encrypted on the wire."
            checked={lan?.enabled ?? false}
            disabled={lan?.envForced ?? false}
            onCheckedChange={setLanEnabled}
            envForcedHint={
              lan?.envForced === true
                ? 'Locked on at daemon startup — change it from the host CLI or service.'
                : undefined
            }
            url={lan?.url}
            numericUrl={lan?.numericUrl}
            emptyHint={
              lan?.error === 'in-use'
                ? `Port ${lan.port} is in use.`
                : 'No local network interface found.'
            }
          />
          <ShareToggleRow
            label="Tailscale"
            description="Private, WireGuard-encrypted access for devices on your tailnet."
            checked={tailnet?.enabled ?? false}
            disabled={tailnet?.envForced ?? false}
            onCheckedChange={setTailnetEnabled}
            envForcedHint={
              tailnet?.envForced === true
                ? 'Locked on at daemon startup — change it from the host CLI or service.'
                : undefined
            }
            url={tailnet?.url}
            emptyHint={
              tailnet?.error === 'in-use'
                ? `Port ${tailnet.port} is in use.`
                : 'No Tailscale interface found.'
            }
          />
          <ShareToggleRow
            label="Internet"
            description="Public HTTPS through Tailscale Funnel. Anyone can reach the sign-in surface."
            checked={funnel?.enabled ?? false}
            disabled={
              funnelPending ||
              funnel?.envForced === true ||
              (funnel?.enabled === true && funnel.managed === false)
            }
            onCheckedChange={setFunnelEnabled}
            envForcedHint={
              funnel?.envForced === true
                ? 'Locked on at daemon startup — change it from the host CLI or service.'
                : funnel?.error === 'conflict'
                  ? 'Another Funnel target is already configured; Porcelain left it untouched.'
                  : funnel?.enabled === true && funnel.managed === false
                    ? 'This Funnel was not created by Porcelain and cannot be changed here.'
                    : undefined
            }
            url={funnel?.url}
            emptyHint={
              funnel?.error === 'unavailable'
                ? 'Tailscale Funnel is unavailable on this machine.'
                : 'Funnel is not configured.'
            }
          />
        </div>
      </section>
      <PairDevice endpoints={endpoints} />
      <AccessList />
    </div>
  )
}
