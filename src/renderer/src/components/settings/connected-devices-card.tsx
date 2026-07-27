import type { ConnectedDevice } from '@backend/api'
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
import { useConnectedDevices, useRevokeDevice } from '@renderer/hooks/use-devices'
import { rowActionClass } from '@renderer/lib/controls'
import { TestIds } from '@shared/test-ids'
import { useState } from 'react'

/**
 * Coarse "last seen" buckets — the same shape the agent lists use, kept local because
 * each surface picks its own wording ("5m ago" here vs the agent rows' bare "5m").
 */
function relativeTime(ms: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.round(days / 7)}w ago`
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`

/**
 * What this device is doing right now, or when it was last here. The activity parts
 * are what make the roster a trust surface rather than a session table — "connected"
 * alone doesn't tell you whether something is running your terminals.
 */
function describeDevice(device: ConnectedDevice): string {
  if (device.connections === 0) return `Last seen ${relativeTime(device.lastSeenAt)}`
  const parts = ['Connected']
  if (device.terminals > 0) parts.push(plural(device.terminals, 'terminal'))
  if (device.repo !== undefined) parts.push(device.repo)
  return parts.join(' · ')
}

function DeviceRow({ device }: { device: ConnectedDevice }): React.JSX.Element {
  const { revoke, isPending } = useRevokeDevice()
  const [confirming, setConfirming] = useState(false)

  return (
    <li
      className="flex items-center justify-between gap-3 p-3"
      data-testid={TestIds.connectedDeviceRow(device.id)}
    >
      <div className="min-w-0">
        <p className="text-sm-minus font-medium">{device.label}</p>
        <p className="truncate text-xs text-muted-foreground">{describeDevice(device)}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className={rowActionClass}
        disabled={isPending}
        onClick={() => setConfirming(true)}
      >
        Revoke
      </Button>
      {/* Confirmed, not immediate: revoking drops the credential and kills that device's
          live sockets, and the only way back is walking over to it and pairing again. */}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke “{device.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This device loses access immediately and any connection it has open is closed. To use
              it again you’ll have to pair it from scratch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => revoke(device.id)}>
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

/**
 * Who can reach this daemon, what they're doing with it, and the button that cuts one
 * off. Since phase 4 each paired device holds its own credential, so revoke is per
 * device instead of "rotate the shared token and re-pair everything".
 */
export function ConnectedDevicesCard(): React.JSX.Element {
  const data = useConnectedDevices()
  const devices = data?.devices ?? []
  const sharedTokenConnections = data?.sharedTokenConnections ?? 0

  return (
    <div className="flex flex-col gap-2" data-testid={TestIds.connectedDevices}>
      {devices.length === 0 ? (
        <p className="rounded-md border border-border/60 p-3 text-xs text-muted-foreground">
          No paired devices yet. Pair one above and it shows up here, with a Revoke button.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
          {devices.map((device) => (
            <DeviceRow key={device.id} device={device} />
          ))}
        </ul>
      )}
      {/* Muted, not a warning: the shared token is still the supported compatibility path
          for setups that paired before phase 4 — it just can't be revoked one device at a
          time, which is the only thing the human needs to know here. */}
      {sharedTokenConnections > 0 && (
        <p className="text-xs text-muted-foreground">
          {plural(sharedTokenConnections, 'client')} connected with the shared token. Those can’t be
          revoked individually — pair them again to give each its own credential.
        </p>
      )}
    </div>
  )
}
