import { CheckIcon, MessageSquareIcon, RotateCcwIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { FileTypeIcon } from '@/features/files/index';
import type { CommentAnchor } from '../rules/comments';
import type { DocumentRef } from '../rules/documents';
import { basename, type ReviewStatus } from '../rules/review';

type OpenDocument = (ref: DocumentRef, anchor?: CommentAnchor) => void;

export const ROW =
  'flex w-full min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[12.5px] transition-colors hover:bg-accent';

export function ChangeRow({
  path,
  document,
  note,
  scopes,
  reviewStatus,
  commentCount,
  active,
  onOpen,
  indented = false,
}: {
  path: string;
  document: DocumentRef;
  note: string | undefined;
  scopes: readonly string[];
  reviewStatus: ReviewStatus | undefined;
  commentCount: number;
  active: boolean;
  onOpen: OpenDocument;
  indented?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${basename(path)}${scopes.length > 0 ? ` · ${scopes.join(' + ')}` : ''}`}
      title={note == null ? path : `${path}\n${note}`}
      className={cn(
        ROW,
        'text-muted-foreground',
        indented && 'pl-7',
        active && 'bg-accent font-medium text-foreground',
      )}
      onClick={() => onOpen(document)}
    >
      <ReviewStatusIcon status={reviewStatus} />
      <FileTypeIcon path={path} className="size-3.5 shrink-0" />
      <span
        className={cn(
          'min-w-0 flex-1 truncate',
          reviewStatus === 'reviewed' &&
            'line-through decoration-muted-foreground/40',
        )}
      >
        {basename(path)}
      </span>
      {commentCount > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-[10.5px]">
          <MessageSquareIcon className="size-3" />
          {commentCount}
        </span>
      )}
    </button>
  );
}

function ReviewStatusIcon({ status }: { status: ReviewStatus | undefined }) {
  const normalized = status ?? 'unreviewed';
  return (
    <span
      className="grid w-3.5 shrink-0 place-items-center"
      data-review-state={normalized}
      title={reviewStatusLabel(status)}
    >
      {normalized === 'reviewed' ? (
        <CheckIcon className="size-3.5 text-graph-2" />
      ) : normalized === 'stale' ? (
        <RotateCcwIcon className="size-3 text-graph-4" />
      ) : (
        <span className="size-1.5 rounded-full bg-muted-foreground/60" />
      )}
    </span>
  );
}

function reviewStatusLabel(status: ReviewStatus | undefined) {
  if (status === 'reviewed') return 'Reviewed';
  if (status === 'stale') return 'Changed since review';
  return 'Not reviewed';
}
