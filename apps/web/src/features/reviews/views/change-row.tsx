import {
  CheckIcon,
  CopyIcon,
  FileDiffIcon,
  FileIcon,
  HistoryIcon,
  MessageSquareIcon,
  MessageSquarePlusIcon,
  RotateCcwIcon,
  Undo2Icon,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/shared/lib/utils';
import { copyText } from '@/shared/workspace/copy';
import { FileTypeIcon } from '@/features/files/index';
import type { DocumentRef, OpenDocument } from '../rules/documents';
import { basename, type ReviewStatus } from '@porcelain/client/reviews/rules';

export const ROW =
  'flex w-full min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-left text-caption transition-colors hover:bg-accent aria-pressed:bg-accent aria-pressed:font-medium';

export function ChangeRow({
  path,
  document,
  note,
  scopes,
  reviewStatus,
  commentCount,
  active,
  onOpen,
  onReview,
  canReview,
  onDiscard,
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
  onReview: () => void;
  canReview: boolean;
  onDiscard?: () => void;
  indented?: boolean;
}) {
  const label = `${basename(path)}${scopes.length > 0 ? ` · ${scopes.join(' + ')}` : ''}`;
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            type="button"
            aria-pressed={active}
            aria-label={label}
            title={
              note === null || note === undefined ? path : `${path}\n${note}`
            }
            className={cn(
              ROW,
              'text-muted-foreground',
              indented && 'pl-7',
              active && 'bg-accent font-medium text-foreground',
            )}
            onClick={() => onOpen(document)}
          />
        }
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
          <span className="flex shrink-0 items-center gap-0.5 text-2xs">
            <MessageSquareIcon className="size-3" />
            {commentCount}
          </span>
        )}
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-52">
        <ContextMenuItem disabled={!canReview} onClick={onReview}>
          <CheckIcon />
          {reviewMenuLabel(reviewStatus)}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() =>
            onOpen(
              document,
              { kind: 'file', filePath: path },
              { compose: true },
            )
          }
        >
          <MessageSquarePlusIcon />
          Comment
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onOpen(document)}>
          <FileDiffIcon />
          Open diff
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onOpen({ kind: 'file', path })}>
          <FileIcon />
          Open file
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onOpen({ kind: 'timeline', path })}>
          <HistoryIcon />
          Show timeline
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => copyText(path, 'relative path')}>
          <CopyIcon />
          Copy relative path
        </ContextMenuItem>
        {onDiscard && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={onDiscard}>
              <Undo2Icon />
              Discard
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function reviewMenuLabel(status: ReviewStatus | undefined) {
  if (status === 'reviewed') return 'Unmark as reviewed';
  if (status === 'stale') return 'Mark as reviewed again';
  return 'Mark as reviewed';
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
