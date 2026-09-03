import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import {
  useAccessStatus,
  useCloudflareStatus,
  useIssueManagedEnvironmentBundle,
  useIssuePairingLink,
  useLanStatus,
  useRevokeAuthorizedClient,
  useRevokePairingLink,
  useSetCloudflareBind,
  useSetLanBind,
  useSetTailnetBind,
  useTailnetStatus,
  useWslDistributions,
} from '@renderer/features/remote'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { compactButtonClass, rowActionClass } from '@renderer/lib/controls'
import { isWindowsShell } from '@renderer/lib/platform'
import { copyText } from '@renderer/lib/utils'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { useEffect, useState } from 'react'

type ShareEndpoint = { label: string; url: string }

/** Encode only while a live pairing link is visible; pairing secrets never leave this renderer. */
function PairingQr({ value }: { value: string }): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setSrc(null)
    void import('qrcode')
      .then(async (qrcode) => {
        const svg = await qrcode.toString(value, { type: 'svg', margin: 1, width: 148 })
        if (active) setSrc(`data:image/svg+xml,${encodeURIComponent(svg)}`)
      })
      .catch(() => {
        if (active) setSrc(null)
      })
    return () => {
      active = false
    }
  }, [value])

  return (
    <div className="size-[148px] shrink-0 overflow-hidden rounded-md bg-white">
      {src !== null && <img src={src} alt="Pairing QR code" className="size-full" />}
    </div>
  )
}

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
  const managedBundle = useIssueManagedEnvironmentBundle()
  const hasManagedWsl = (useWslDistributions() ?? []).some(
    (distribution) => distribution.environmentId !== null,
  )

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
          onChange={(event: React.ChangeEvent<HTMLInputElement>): void =>
            setLabel(event.target.value)
          }
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
              onClick={() => {
                runUserAction(
                  async () => {
                    const result = await issue({ label, baseUrl: endpoint.url })
                    setCreatedUrl(result.url)
                    await copyText(result.url)
                  },
                  (error) => {
                    toastUserActionError('Create pairing link', error)
                  },
                )
              }}
            >
              {isPending ? 'Creating…' : `Create ${endpoint.label} link`}
            </Button>
          ))}
          {isWindowsShell && hasManagedWsl && (
            <Button
              variant="default"
              size="sm"
              className={compactButtonClass}
              disabled={isPending || managedBundle.isPending || label.trim() === ''}
              onClick={() => {
                runUserAction(
                  async () => {
                    const result = await managedBundle.issue(label)
                    setCreatedUrl(result.url)
                    await copyText(result.url)
                  },
                  (error) => {
                    toastUserActionError('Create Windows + WSL link', error)
                  },
                )
              }}
            >
              {managedBundle.isPending ? 'Creating…' : 'Create Windows + WSL link'}
            </Button>
          )}
        </div>
        {endpoints.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Turn on a reachable network before creating a link.
          </p>
        )}
        {createdUrl !== '' && (
          <div className="flex flex-col gap-3 rounded-md bg-muted/50 p-3 sm:flex-row sm:items-start">
            <PairingQr value={createdUrl} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-xs font-medium">Scan on the other device</p>
              <p className="break-all font-mono text-xs text-muted-foreground">{createdUrl}</p>
              <Button
                variant="outline"
                size="sm"
                className={`${rowActionClass} self-start`}
                onClick={() => {
                  runUserAction(
                    () => copyText(createdUrl),
                    (error) => {
                      toastUserActionError('Copy pairing link', error)
                    },
                  )
                }}
              >
                Copy
              </Button>
            </div>
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
  return <LocalShareSettings />
}

function LocalShareSettings(): React.JSX.Element {
  const tailnet = useTailnetStatus()
  const { setEnabled: setTailnetEnabled, isPending: tailnetPending } = useSetTailnetBind()
  const lan = useLanStatus()
  const { setEnabled: setLanEnabled } = useSetLanBind()
  const cloudflare = useCloudflareStatus()
  const { setEnabled: setCloudflareEnabled, isPending: cloudflarePending } = useSetCloudflareBind()

  const lanUrl =
    lan?.numericUrl != null && lan.numericUrl !== '' ? lan.numericUrl : (lan?.url ?? null)
  const endpoints: ShareEndpoint[] = [
    ...(lanUrl == null ? [] : [{ label: 'LAN', url: lanUrl }]),
    ...(tailnet?.url == null ? [] : [{ label: 'Tailscale', url: tailnet.url }]),
    ...(cloudflare?.url == null ? [] : [{ label: 'Cloudflare', url: cloudflare.url }]),
  ]

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">This daemon</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            LAN is the fastest route. Pick Tailscale or Cloudflare for when you leave this network.
            Clients try LAN, then Tailscale, then Cloudflare.
          </p>
        </div>
        <div className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
          <ShareToggleRow
            label="Local network"
            description="Same Wi‑Fi or LAN. Fastest. Traffic is not encrypted on the wire."
            checked={lan?.enabled ?? false}
            disabled={lan?.envForced ?? false}
            onCheckedChange={(enabled) => {
              setLanEnabled(enabled)
            }}
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
            description="Private WireGuard for your own devices. Turns Cloudflare off."
            checked={tailnet?.enabled ?? false}
            disabled={
              tailnetPending || tailnet?.envForced === true || cloudflare?.envForced === true
            }
            onCheckedChange={(enabled) => {
              setTailnetEnabled(enabled)
            }}
            envForcedHint={
              tailnet?.envForced === true
                ? 'Locked on at daemon startup — change it from the host CLI or service.'
                : cloudflare?.envForced === true
                  ? 'Cloudflare is locked on at daemon startup, so Tailscale stays off here.'
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
            label="Cloudflare"
            description="Public HTTPS through a Cloudflare tunnel. Turns Tailscale off."
            checked={cloudflare?.enabled ?? false}
            disabled={
              cloudflarePending ||
              cloudflare?.envForced === true ||
              tailnet?.envForced === true ||
              (cloudflare?.enabled === true && cloudflare.managed === false)
            }
            onCheckedChange={(enabled) => {
              setCloudflareEnabled(enabled)
            }}
            envForcedHint={
              cloudflare?.envForced === true
                ? 'Locked on at daemon startup — change it from the host CLI or service.'
                : tailnet?.envForced === true
                  ? 'Tailscale is locked on at daemon startup, so Cloudflare stays off here.'
                  : cloudflare?.error === 'conflict'
                    ? 'Another tunnel is already configured; Porcelain left it untouched.'
                    : cloudflare?.enabled === true && cloudflare.managed === false
                      ? 'This tunnel was not created by Porcelain and cannot be changed here.'
                      : undefined
            }
            url={cloudflare?.url}
            emptyHint={
              cloudflare?.error === 'unavailable'
                ? 'cloudflared is not installed or not on PATH.'
                : 'Cloudflare is not configured.'
            }
          />
        </div>
      </section>
      <PairDevice endpoints={endpoints} />
      <AccessList />
    </div>
  )
}
