import type { EvidenceAsset } from '@porcelain/contracts/review'
import { formatBytes } from '@renderer/components/shell/publish-review-button'
import { Dialog, DialogContent, DialogTitle } from '@renderer/components/ui/dialog'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { formatEvidenceMb } from '@renderer/lib/evidence-message'
import { TestIds } from '@shared/test-ids'
import { useState } from 'react'
import { useEvidenceAsset } from './review-queries'

/**
 * The Assets sub-tab: `evidence/assets/` as a grid of screenshots.
 *
 * Bytes ride the authenticated tRPC channel one image at a time (the daemon
 * serves no user files over HTTP), so a tile is a Skeleton until its own query
 * lands and the whole gallery is gated on `active` — a pack can be tens of
 * megabytes and nobody pays for a sub-tab they never open.
 *
 * Tap-to-zoom is a Dialog with ←/→ stepping the pack. The handler is local to
 * the dialog on purpose: this is modal navigation, not an app shortcut, and it
 * must not exist while the gallery is closed.
 */
export function EvidenceGallery({
  assets,
  active,
}: {
  assets: EvidenceAsset[]
  active: boolean
}): React.JSX.Element {
  const [zoomed, setZoomed] = useState<number | null>(null)
  const current = zoomed === null ? undefined : assets[zoomed]

  const step = (delta: number): void => {
    setZoomed((index) => (index === null ? null : (index + delta + assets.length) % assets.length))
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto p-3" data-testid={TestIds.evidenceGallery}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {assets.map((asset, index) => (
          <GalleryTile
            key={asset.file}
            asset={asset}
            active={active}
            onZoom={() => setZoomed(index)}
          />
        ))}
      </div>
      {current && (
        <Dialog
          open
          onOpenChange={(open: boolean): void => {
            if (!open) setZoomed(null)
          }}
        >
          <DialogContent
            data-testid={TestIds.evidenceGalleryZoom}
            className="max-w-[calc(100%-2rem)] sm:max-w-4xl"
            onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>): void => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
              event.preventDefault()
              step(event.key === 'ArrowRight' ? 1 : -1)
            }}
          >
            <DialogTitle className="sr-only">{current.label}</DialogTitle>
            <ZoomBody asset={current} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function GalleryTile({
  asset,
  active,
  onZoom,
}: {
  asset: EvidenceAsset
  active: boolean
  onZoom: () => void
}): React.JSX.Element {
  const { asset: body, isLoading } = useEvidenceAsset(asset.file, active)
  return (
    <button
      type="button"
      onClick={onZoom}
      data-testid={TestIds.evidenceGalleryItem(asset.file)}
      className="flex flex-col overflow-hidden rounded-md border text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span className="block aspect-video w-full overflow-hidden bg-muted">
        {isLoading ? (
          <Skeleton className="size-full rounded-none" />
        ) : body ? (
          <img src={body.dataUrl} alt={asset.label} className="size-full object-cover" />
        ) : null}
      </span>
      <span className="truncate px-2 py-1.5 text-2xs text-muted-foreground">
        {isLoading || body ? `${asset.label} · ${formatBytes(asset.bytes)}` : overCap(asset)}
      </span>
    </button>
  )
}

/** The image itself, re-queried by file so ←/→ swaps the body inside one dialog. */
function ZoomBody({ asset }: { asset: EvidenceAsset }): React.JSX.Element {
  const { asset: body, isLoading } = useEvidenceAsset(asset.file, true)
  if (isLoading) return <Skeleton className="h-[60vh] w-full" />
  if (!body) return <p className="p-4 text-sm text-muted-foreground">{overCap(asset)}</p>
  return <img src={body.dataUrl} alt={asset.label} className="max-h-[80vh] w-full object-contain" />
}

/** Over-cap (or vanished) tile copy — size comes from the listing, not the body. */
function overCap(asset: EvidenceAsset): string {
  return `Too large to preview (${formatEvidenceMb(asset.bytes)})`
}
