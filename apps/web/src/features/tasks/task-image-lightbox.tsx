import { Dialog, DialogContent, DialogTitle } from '@renderer/components/ui/dialog'

export function TaskImageLightbox({
  image,
  onClose,
}: {
  image: { src: string; name: string } | null
  onClose: () => void
}): React.JSX.Element {
  return (
    <Dialog open={image !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl border-0 bg-transparent p-0 shadow-none ring-0">
        <DialogTitle className="sr-only">{image?.name ?? 'Image'}</DialogTitle>
        {image !== null && (
          <img
            src={image.src}
            alt={image.name}
            className="max-h-[85vh] w-full rounded-lg object-contain"
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
