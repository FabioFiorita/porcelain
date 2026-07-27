import { Button } from '@renderer/components/ui/button'
import { useCancelPairing, usePairingStatus, useStartPairing } from '@renderer/hooks/use-pairing'
import { compactButtonClass } from '@renderer/lib/controls'
import { buildPairingLink } from '@renderer/lib/pairing-link'
import { cn, copyText } from '@renderer/lib/utils'
import { useEffect, useState } from 'react'

/**
 * "Pair a device" — short-lived code + QR that hands out THIS daemon's shared token
 * (no per-device credentials). Scanning lands on the browser client already connected
 * (see `use-token-gate`). The url must be one the OTHER device can reach.
 */
export function PairingCard({ url }: { url: string }): React.JSX.Element {
  const pending = usePairingStatus()
  const { start, isPending: isStarting } = useStartPairing()
  const { cancel } = useCancelPairing()
  const [copied, setCopied] = useState(false)

  if (pending == null) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          className={cn('self-start', compactButtonClass)}
          disabled={isStarting}
          onClick={() => start()}
        >
          {isStarting ? 'Starting…' : 'Pair a device'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Opens a short-lived code another device can scan or paste.
        </p>
      </div>
    )
  }

  const link = buildPairingLink(url, pending.code)

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border/60 p-3">
      <div className="flex items-start gap-3">
        <PairingQr value={link} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-2xs font-medium tracking-wider text-muted-foreground uppercase">
            Scan on the other device
          </p>
          <p className="font-mono text-lg tracking-widest">{pending.code}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{link}</p>
          <Expiry expiresAt={pending.expiresAt} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className={compactButtonClass}
          onClick={async () => {
            // copyText, not navigator.clipboard: the daemon-served browser client is an
            // insecure context where that API is absent (architecture skill).
            await copyText(link)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        <Button variant="ghost" size="sm" className={compactButtonClass} onClick={() => cancel()}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

/**
 * The code is single-use and TTL-bounded, so the human needs to know whether the one on
 * screen is still live. Ticks locally off the daemon-supplied deadline — no extra query.
 */
function Expiry({ expiresAt }: { expiresAt: number }): React.JSX.Element {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const remaining = Math.max(0, expiresAt - now)
  if (remaining === 0) {
    return <p className="text-xs text-muted-foreground">Expired — start a new one.</p>
  }
  const minutes = Math.floor(remaining / 60_000)
  const seconds = Math.floor((remaining % 60_000) / 1000)
  return (
    <p className="text-xs text-muted-foreground">
      Expires in {minutes}:{String(seconds).padStart(2, '0')}
    </p>
  )
}

/**
 * The link as a QR. Rendered to a data URL rather than a canvas so it survives the
 * app's normal re-renders and needs no ref plumbing; `img-src 'self' data:` in the CSP
 * already allows it, so this adds no CSP change.
 */
function PairingQr({ value }: { value: string }): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    // Dynamic import: the QR encoder is only ever needed while a pairing card is open,
    // so it stays out of the main renderer chunk.
    void import('qrcode').then(async (qrcode) => {
      const dataUrl = await qrcode.toDataURL(value, { margin: 1, width: 132 })
      if (active) setSrc(dataUrl)
    })
    return () => {
      active = false
    }
  }, [value])

  return (
    <div className="size-[132px] shrink-0 overflow-hidden rounded-md bg-white">
      {src !== null && <img src={src} alt="Pairing QR code" className="size-full" />}
    </div>
  )
}
