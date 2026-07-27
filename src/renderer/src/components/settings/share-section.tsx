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
import { pairingUrl } from '@renderer/lib/pairing-link'
import { copyText } from '@renderer/lib/utils'
import { TestIds } from '@shared/test-ids'
import { useState } from 'react'
import { PairingCard } from './pairing-card'

/** Copy the daemon token — the fallback when pairing is not available. */
function CopyTokenButton(): React.JSX.Element {
  const daemonToken = useDaemonToken()
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      className={compactButtonClass}
      onClick={async () => {
        // copyText, not navigator.clipboard: the daemon-served browser client is an
        // insecure context where that API is absent (architecture skill).
        await copyText(daemonToken)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? 'Copied' : 'Copy token'}
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
      {url != null && (
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs text-muted-foreground">{url}</p>
          {numericUrl != null && numericUrl !== url && (
            <p className="font-mono text-xs text-muted-foreground">{numericUrl}</p>
          )}
        </div>
      )}
      {checked && url == null && <p className="text-xs text-muted-foreground">{emptyHint}</p>}
    </div>
  )
}

/**
 * One connect block for the whole Share tab: pick the best reachable URL (LAN numeric
 * preferred for QR reliability — see pairingUrl), then Pair / Copy token once. Nested
 * under each toggle was the old mess (two cards when both binds were on).
 */
function ConnectBlock({
  tailnetUrl,
  lanUrl,
  lanNumericUrl,
}: {
  tailnetUrl: string | null | undefined
  lanUrl: string | null | undefined
  lanNumericUrl: string | null | undefined
}): React.JSX.Element | null {
  // Prefer LAN for the pairing link when both are up: same Wi‑Fi is the usual "scan from
  // the couch" path. Fall back to tailnet when only that is on.
  const displayUrl = lanUrl ?? tailnetUrl
  if (displayUrl == null) return null
  const connectUrl = pairingUrl(displayUrl, lanUrl != null ? lanNumericUrl : null)

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Connect another device</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          One shared token for every client. Pair below, or copy the raw token.
        </p>
      </div>
      <div className="flex flex-col gap-3 rounded-md border border-border/60 p-3">
        <p className="truncate font-mono text-xs text-muted-foreground">{connectUrl}</p>
        <div className="flex items-center gap-2">
          <CopyTokenButton />
        </div>
        <PairingCard url={connectUrl} />
        <p className="text-xs text-muted-foreground">
          The raw token is also at <span className="font-mono">~/.porcelain/daemon-token</span>.
        </p>
      </div>
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
          Every client uses the same token. Revoke all rotates it — every connection stops until
          they reconnect with the new one.
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
              window keeps the new token; other devices need to pair or paste the new token again.
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
 * Share this daemon on the LAN / tailnet, connect other devices, revoke everyone.
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
            Let other devices reach this daemon. Always token-gated.
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

      <ConnectBlock tailnetUrl={tailnet?.url} lanUrl={lan?.url} lanNumericUrl={lan?.numericUrl} />

      <ClientsAndRevoke />
    </div>
  )
}
