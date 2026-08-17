import type { TaskLink, TaskPathRef } from '@porcelain/contracts/tasks'
import { Badge } from '@renderer/components/ui/badge'
import { TestIds } from '@shared/test-ids'
import { Folder, Link2, X } from 'lucide-react'
import type { ComposerPicture } from './task-composer'

export function TaskComposerChips({
  tags,
  pathRefs,
  links,
  onRemoveTag,
  onRemovePath,
  onRemoveLink,
}: {
  tags: readonly string[]
  pathRefs: readonly TaskPathRef[]
  links: readonly TaskLink[]
  onRemoveTag: (tag: string) => void
  onRemovePath: (path: string) => void
  onRemoveLink: (url: string) => void
}): React.JSX.Element | null {
  if (tags.length === 0 && pathRefs.length === 0 && links.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <Badge key={`tag:${tag}`} variant="outline" className="gap-1">
          #{tag}
          <button type="button" aria-label={`Remove tag ${tag}`} onClick={() => onRemoveTag(tag)}>
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      {pathRefs.map((ref) => (
        <Badge
          key={`path:${ref.path}`}
          variant="outline"
          className="gap-1"
          data-testid={TestIds.tasksComposerPath(ref.path)}
        >
          <Folder className="size-3" />
          {ref.path}
          <button
            type="button"
            aria-label={`Remove ${ref.path}`}
            onClick={() => onRemovePath(ref.path)}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      {links.map((link) => (
        <Badge key={`link:${link.url}`} variant="outline" className="gap-1">
          <Link2 className="size-3" />
          <a href={link.url} target="_blank" rel="noreferrer" className="hover:underline">
            {link.label}
          </a>
          <button
            type="button"
            aria-label={`Remove ${link.label}`}
            onClick={() => onRemoveLink(link.url)}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  )
}

export function TaskComposerPictures({
  existing,
  uploads,
  onPreview,
  onRemoveExisting,
  onRemoveUpload,
}: {
  existing: readonly { id: string; name: string; previewUrl?: string }[]
  uploads: readonly ComposerPicture[]
  onPreview: (image: { src: string; name: string }) => void
  onRemoveExisting?: (id: string) => void
  onRemoveUpload: (index: number) => void
}): React.JSX.Element | null {
  if (existing.length === 0 && uploads.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {existing.map((picture) => (
        <div key={picture.id} className="relative overflow-hidden rounded-md border bg-muted/30">
          <button
            type="button"
            className="block"
            onClick={() =>
              picture.previewUrl !== undefined &&
              onPreview({ src: picture.previewUrl, name: picture.name })
            }
          >
            {picture.previewUrl !== undefined ? (
              <img
                src={picture.previewUrl}
                alt={picture.name}
                className="h-28 w-auto max-w-full object-cover"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center text-2xs text-muted-foreground">
                {picture.name}
              </div>
            )}
          </button>
          {onRemoveExisting !== undefined && (
            <button
              type="button"
              aria-label={`Remove ${picture.name}`}
              className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5"
              onClick={() => onRemoveExisting(picture.id)}
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      ))}
      {uploads.map((upload, index) => (
        <div
          key={`${upload.name}:${upload.contentBase64.slice(0, 24)}`}
          data-testid={TestIds.tasksComposerPicture(upload.name)}
          className="relative overflow-hidden rounded-md border bg-muted/30"
        >
          <button
            type="button"
            className="block"
            onClick={() =>
              upload.previewUrl !== undefined &&
              onPreview({ src: upload.previewUrl, name: upload.name })
            }
          >
            {upload.previewUrl !== undefined ? (
              <img
                src={upload.previewUrl}
                alt={upload.name}
                className="h-28 w-auto max-w-full object-cover"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center text-2xs text-muted-foreground">
                {upload.name}
              </div>
            )}
          </button>
          <button
            type="button"
            aria-label={`Remove ${upload.name}`}
            className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5"
            onClick={() => onRemoveUpload(index)}
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
