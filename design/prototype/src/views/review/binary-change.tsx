import { MessageSquarePlus } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { CodeAnchor, CommentThread } from '../../domain/comments';
import {
  basename,
  isImagePath,
  type ReviewScope,
  type ReviewState,
} from '../../domain/review';
import { usePreviewLink } from '../../query/files';
import type { BinaryEntry } from './diff-entries';
import { FileTick } from './document-parts';
import { FileTypeIcon } from './file-type-icon';
import { NewThreadComposer } from './inline-composer';
import { ReviewBoundary } from './review-boundary';
import { ThreadCard } from './thread-card';

/** Transparent pixels show as a checkerboard, as in any image viewer. */
const CHECKERBOARD =
  'bg-[image:repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] bg-size-[16px_16px]';

/** One image from its signed link; `revision: 'HEAD'` reads it as last committed. */
export function ImagePreview({
  scope,
  path,
  revision,
  label,
  className,
}: {
  scope: ReviewScope;
  path: string;
  revision?: string;
  label?: string;
  /** For the image itself, e.g. its largest height. */
  className?: string;
}) {
  const { url } = usePreviewLink(scope, path, revision);
  const [size, setSize] = useState<{
    url: string;
    width: number;
    height: number;
  } | null>(null);
  const loaded = size?.url === url ? size : null;
  return (
    <figure className="flex min-w-0 flex-col gap-1.5">
      {(label != null || loaded != null) && (
        <figcaption className="flex h-4 items-center gap-1.5 text-[11px] text-muted-foreground">
          {label != null && (
            <span className="font-medium text-foreground">{label}</span>
          )}
          {loaded != null && (
            <span className="tabular-nums">
              {loaded.width} × {loaded.height}
            </span>
          )}
        </figcaption>
      )}
      <div
        className={cn(
          'grid min-h-24 place-items-center rounded-lg border p-3',
          CHECKERBOARD,
        )}
      >
        <img
          src={url}
          alt={
            label == null
              ? basename(path)
              : `${basename(path)}, ${label.toLowerCase()}`
          }
          onLoad={(event) =>
            setSize({
              url,
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
          className={cn('max-w-full object-contain', className)}
        />
      </div>
    </figure>
  );
}

function PreviewPending() {
  return <Skeleton className="h-32 rounded-lg" />;
}

/** Before and After side by side, stacked when narrow; an added image has only After, a deleted one only Before. */
export function ImageComparison({
  scope,
  entry,
  className,
}: {
  scope: ReviewScope;
  entry: BinaryEntry;
  className?: string;
}) {
  const both = entry.before != null && entry.after != null;
  return (
    <div className="@container">
      <div className={cn('grid gap-3', both && '@[34rem]:grid-cols-2')}>
        {entry.before != null && (
          <ReviewBoundary fallback={<PreviewPending />}>
            <ImagePreview
              scope={scope}
              path={entry.before}
              revision="HEAD"
              label="Before"
              className={className}
            />
          </ReviewBoundary>
        )}
        {entry.after != null && (
          <ReviewBoundary fallback={<PreviewPending />}>
            <ImagePreview
              scope={scope}
              path={entry.after}
              label="After"
              className={className}
            />
          </ReviewBoundary>
        )}
      </div>
    </div>
  );
}

const changeWord = (entry: BinaryEntry) =>
  entry.before == null ? 'added' : entry.after == null ? 'deleted' : 'changed';

/**
 * A changed binary file in a list of changes: no lines, so its tick, Comment (on the
 * whole file) and threads sit around a preview of the image, or a plain line for
 * anything else. `data-binary-path` lets the document tell which file was clicked.
 */
export function BinaryChangeCard({
  scope,
  entry,
  state,
  threads,
  composer,
  onComment,
  onCloseComposer,
  onToggleReviewed,
  actions,
  compact,
}: {
  scope: ReviewScope;
  entry: BinaryEntry;
  state: ReviewState;
  threads: readonly CommentThread[];
  /** The open composer, when it is on this file. */
  composer: CodeAnchor | null;
  onComment?: () => void;
  onCloseComposer: () => void;
  onToggleReviewed?: () => void;
  actions?: ReactNode;
  /** Among other files the previews stay small; a file of its own shows them large. */
  compact: boolean;
}) {
  const image = isImagePath(entry.path);
  return (
    // Drawn like Pierre's file header, so the card reads as one more file among the diffs.
    <section data-binary-path={entry.path} className="@container">
      <div className="flex h-11 items-center gap-1.5 px-1 text-[13px]">
        {onToggleReviewed != null && (
          <FileTick
            path={entry.path}
            state={state}
            onClick={onToggleReviewed}
          />
        )}
        <FileTypeIcon path={entry.path} className="size-4 shrink-0" />
        <span className="min-w-0 truncate" title={entry.path}>
          {entry.path}
        </span>
        <span className="ml-1 shrink-0 text-[11.5px] text-muted-foreground @max-[28rem]:hidden">
          {image ? 'Image' : 'Binary file'} {changeWord(entry)}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {onComment != null && (
            <button
              type="button"
              aria-label={`Comment on ${entry.path}`}
              onClick={onComment}
              className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <MessageSquarePlus className="size-3.5" />
              Comment
            </button>
          )}
          {actions}
        </span>
      </div>
      <div className="flex flex-col gap-3 px-1 pb-3">
        {image ? (
          <ImageComparison
            scope={scope}
            entry={entry}
            className={compact ? 'max-h-64' : 'max-h-[60vh]'}
          />
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-2 text-[12.5px] text-muted-foreground">
            A binary file {changeWord(entry)}. There is no text diff to show.
          </p>
        )}
        {threads.map((thread) => (
          <ThreadCard key={thread.id} thread={thread} scope={scope} />
        ))}
        {composer != null && (
          <NewThreadComposer
            key={JSON.stringify(composer)}
            scope={scope}
            anchor={composer}
            onClose={onCloseComposer}
          />
        )}
      </div>
    </section>
  );
}
