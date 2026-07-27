import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
import { Button } from '@renderer/components/ui/button'
import { Switch } from '@renderer/components/ui/switch'
import { useDaemonToken } from '@renderer/hooks/use-daemon-token'
import { useLanStatus, useSetLanBind } from '@renderer/hooks/use-lan'
import { useRotateDaemonToken, useShareStatus } from '@renderer/hooks/use-share'
import { useSetTailnetBind, useTailnetStatus } from '@renderer/hooks/use-tailnet'
import { compactButtonClass, rowActionClass } from '@renderer/lib/controls'
import { copyText } from '@renderer/lib/utils'
import { TestIds } from '@shared/test-ids'
import { useState } from 'react'

/** Copy any short secret or URL — works in insecure browser contexts too. */
function CopyButton({
  value,
  label = 'Copy',
}: {
  value: string
  label?: string
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      className={compactButtonClass}
      disabled={value === ''}
      onClick={async () => {
        await copyText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? 'Copied' : label}
    </Button>
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
  // Prefer the numeric LAN address when present — `.local` names are flaky on some
  // hosts (IPv6 AAAA while the daemon is IPv4-only).
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
      {envForcedLabel != null && <p className="text-xs text-muted-foreground">{envForcedLabel}</p>}
      {connectUrl != null && (
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
            {connectUrl}
          </p>
          <CopyButton value={connectUrl} label="Copy URL" />
        </div>
      )}
      {checked && connectUrl == null && (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      )}
    </div>
  )
}

/**
 * How to reach this daemon from another device: the share URLs (above) plus the one
 * shared token. No pairing codes, no QR — open the URL in a browser or paste URL +
 * token into Settings → Remotes on another Mac.
 */
function TokenBlock(): React.JSX.Element {
  const token = useDaemonToken()
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Token</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          One secret for every client. Open a share URL in a browser and paste this, or add a remote
          with URL + token.
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3">
        <p className="min-w-0 truncate font-mono text-xs text-muted-foreground">
          {token === '' ? '…' : `${token.slice(0, 8)}…${token.slice(-8)}`}
        </p>
        <CopyButton value={token} label="Copy token" />
      </div>
      <p className="text-xs text-muted-foreground">
        Also at <span className="font-mono">~/.porcelain/daemon-token</span>.
      </p>
    </div>
  )
}

function ClientsAndRevoke(): React.JSX.Element {
  const status = useShareStatus()
  const { rotate, isPending } = useRotateDaemonToken()
  const [confirming, setConfirming] = useState(false)
  const clients = status?.clients ?? 0
  const label =
    clients === 0
      ? 'No clients connected'
      : clients === 1
        ? '1 client connected'
        : `${clients} clients connected`

  return (
    <div className="flex flex-col gap-3" data-testid={TestIds.shareStatus}>
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Access</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Revoke all rotates the token — every connection stops until clients get the new one.
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3">
        <p className="text-sm-minus font-medium">{label}</p>
        <Button
          variant="outline"
          size="sm"
          className={rowActionClass}
          disabled={isPending}
          onClick={() => setConfirming(true)}
          data-testid={TestIds.shareRevokeAll}
        >
          Revoke all
        </Button>
      </div>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke all access?</AlertDialogTitle>
            <AlertDialogDescription>
              This rotates the daemon token. Every connected client loses access immediately. This
              window keeps the new token; other devices need the new token to reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                rotate()
                setConfirming(false)
              }}
            >
              Revoke all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * Share this daemon on the LAN / tailnet. Connection = open a share URL + the token.
 * Remotes (machines this app opens windows against) live in the Remotes tab.
 */
export function ShareSection(): React.JSX.Element {
  const tailnet = useTailnetStatus()
  const { setEnabled: setTailnetEnabled } = useSetTailnetBind()
  const lan = useLanStatus()
  const { setEnabled: setLanEnabled } = useSetLanBind()

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Share this device</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Turn on a network, copy its URL and the token. That is all another device needs.
          </p>
        </div>
        <div className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
          <ShareToggleRow
            label="Share on local network"
            description="Same Wi‑Fi / LAN — token-gated, traffic is unencrypted on the wire."
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
        </div>
      </section>

      <TokenBlock />
      <ClientsAndRevoke />
    </div>
  )
}
