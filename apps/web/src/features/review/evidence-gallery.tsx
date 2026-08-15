import type { EvidenceAssetBody, EvidenceAssetDescriptor } from '@porcelain/contracts/review'
import { Dialog, DialogContent, DialogTitle } from '@renderer/components/ui/dialog'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { evidenceOverCapMessage } from '@renderer/lib/evidence-message'
import { TestIds } from '@shared/test-ids'
import { useState } from 'react'
import { formatBytes } from './format-bytes'
import { useEvidenceAsset } from './review-queries'

/**
 * The Assets sub-tab: `evidence/assets/` as a grid of screenshots and videos.
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
  assets: readonly EvidenceAssetDescriptor[]
  active: boolean
}): React.JSX.Element {
  const [zoomed, setZoomed] = useState<number | null>(null)
  const zoomableAssets = assets.filter(
    (asset): asset is Exclude<EvidenceAssetDescriptor, { kind: 'link' }> => asset.kind !== 'link',
  )
  const current = zoomed === null ? undefined : zoomableAssets[zoomed]

  const step = (delta: number): void => {
    setZoomed((index) =>
      index === null || zoomableAssets.length === 0
        ? null
        : (index + delta + zoomableAssets.length) % zoomableAssets.length,
    )
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto p-3" data-testid={TestIds.evidenceGallery}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {assets.map((asset) => (
          <GalleryTile
            key={asset.file}
            asset={asset}
            active={active}
            onZoom={() => {
              if (asset.kind === 'link') return
              setZoomed(zoomableAssets.findIndex((candidate) => candidate.file === asset.file))
            }}
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
  asset: EvidenceAssetDescriptor
  active: boolean
  onZoom: () => void
}): React.JSX.Element {
  if (asset.kind === 'link') {
    return <GalleryLinkTile asset={asset} />
  }
  return <GalleryMediaTile asset={asset} active={active} onZoom={onZoom} />
}

function GalleryLinkTile({
  asset,
}: {
  asset: Extract<EvidenceAssetDescriptor, { kind: 'link' }>
}): React.JSX.Element {
  return (
    <a
      href={asset.href}
      target="_blank"
      rel="noreferrer"
      data-testid={TestIds.evidenceGalleryItem(asset.file)}
      className="flex flex-col overflow-hidden rounded-md border text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span className="flex aspect-video w-full items-center justify-center bg-muted text-sm text-muted-foreground">
        Open link ↗
      </span>
      <span className="truncate px-2 py-1.5 text-2xs text-muted-foreground">
        {asset.label} · {formatBytes(asset.bytes)}
      </span>
    </a>
  )
}

function GalleryMediaTile({
  asset,
  active,
  onZoom,
}: {
  asset: Exclude<EvidenceAssetDescriptor, { kind: 'link' }>
  active: boolean
  onZoom: () => void
}): React.JSX.Element {
  const { asset: body, isLoading } = useEvidenceAsset(
    asset.file,
    active && asset.state === 'available',
  )
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
          <GalleryMedia asset={asset} body={body} />
        ) : null}
      </span>
      <span className="truncate px-2 py-1.5 text-2xs text-muted-foreground">
        {isLoading || body ? `${asset.label} · ${formatBytes(asset.bytes)}` : overCap(asset)}
      </span>
    </button>
  )
}

/** The media itself, re-queried by file so ←/→ swaps the body inside one dialog. */
function ZoomBody({ asset }: { asset: EvidenceAssetDescriptor }): React.JSX.Element {
  const { asset: body, isLoading } = useEvidenceAsset(asset.file, asset.state === 'available')
  if (isLoading) return <Skeleton className="h-[60vh] w-full" />
  if (!body) return <p className="p-4 text-sm text-muted-foreground">{overCap(asset)}</p>
  return <GalleryMedia asset={asset} body={body} zoomed />
}

function GalleryMedia({
  asset,
  body,
  zoomed = false,
}: {
  asset: EvidenceAssetDescriptor
  body: EvidenceAssetBody
  zoomed?: boolean
}): React.JSX.Element {
  if (asset.kind === 'video') {
    return (
      <video
        src={body.dataUrl}
        aria-label={asset.label}
        className={zoomed ? 'max-h-[80vh] w-full object-contain' : 'size-full object-cover'}
        controls={zoomed}
        muted={!zoomed}
        playsInline
        preload="metadata"
        data-testid={`${TestIds.evidenceGalleryItem(asset.file)}-video`}
      />
    )
  }
  return (
    <img
      src={body.dataUrl}
      alt={asset.label}
      className={zoomed ? 'max-h-[80vh] w-full object-contain' : 'size-full object-cover'}
    />
  )
}

/** Over-cap (or vanished) tile copy — size comes from the descriptor, not the body. */
function overCap(asset: EvidenceAssetDescriptor): string {
  if (asset.state === 'unavailable') return evidenceOverCapMessage(asset)
  return 'Image unavailable'
}
