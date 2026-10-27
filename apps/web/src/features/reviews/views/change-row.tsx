import { TruncatedText } from '@/shared/views/truncated-text';
import { CheckIcon, MessageSquareIcon, RotateCcwIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { copyText } from '@/shared/workspace/copy';
import { FileTypeIcon } from '@/features/files/index';
import type { DocumentRef, OpenDocument } from '../rules/documents';
import {
  basename,
  reviewSidebarActions,
  type ReviewStatus,
  type ReviewSidebarAction,
} from '@porcelain/client/reviews/rules';
import { SidebarActionMenu } from './sidebar-action-menu';

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
  sideLabel,
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
  sideLabel: string;
  onReview: () => void;
  canReview: boolean;
  onDiscard?: () => void;
  indented?: boolean;
}) {
  const label = `${basename(path)}${scopes.length > 0 ? ` · ${scopes.join(' + ')}` : ''}`;
  const act = (id: ReviewSidebarAction['id']) => {
    switch (id) {
      case 'review':
        onReview();
        break;
      case 'comment':
        onOpen(document, { kind: 'file', filePath: path }, { compose: true });
        break;
      case 'open':
        onOpen(document);
        break;
      case 'open-to-side':
        onOpen(document, undefined, { toSide: true });
        break;
      case 'open-file':
        onOpen({ kind: 'file', path });
        break;
      case 'timeline':
        onOpen({ kind: 'timeline', path });
        break;
      case 'copy-relative':
        copyText(path, 'relative path');
        break;
      case 'discard':
        onDiscard?.();
        break;
    }
  };
  return (
    <SidebarActionMenu
      label={`Actions for ${path}`}
      actions={reviewSidebarActions({
        kind: 'file',
        status: reviewStatus,
        canReview,
        sideLabel,
        canDiscard: onDiscard !== undefined,
      })}
      onAction={act}
    >
      {(menu) => (
        <div className="flex min-w-0 items-center">
          <button
            type="button"
            aria-pressed={active}
            aria-label={label}
            title={
              note === null || note === undefined ? path : `${path}\n${note}`
            }
            className={cn(
              ROW,
              'flex-1 text-muted-foreground',
              indented && 'pl-7',
              active && 'bg-accent font-medium text-foreground',
            )}
            onClick={(event) =>
              onOpen(document, undefined, { toSide: event.altKey })
            }
          >
            <ReviewStatusIcon status={reviewStatus} />
            <FileTypeIcon path={path} className="size-3.5 shrink-0" />
            <TruncatedText
              className={cn(
                'min-w-0 flex-1 ',
                reviewStatus === 'reviewed' &&
                  'line-through decoration-muted-foreground/40',
              )}
              text={basename(path)}
            />
            {commentCount > 0 && (
              <span className="flex shrink-0 items-center gap-0.5 text-2xs">
                <MessageSquareIcon className="size-3" />
                {commentCount}
              </span>
            )}
          </button>
          {menu}
        </div>
      )}
    </SidebarActionMenu>
  );
}

export function ReviewStatusIcon({
  status,
}: {
  status: ReviewStatus | undefined;
}) {
  const normalized = status ?? 'unreviewed';
  const label = reviewStatusLabel(status);
  return (
    <span
      role="img"
      aria-label={label}
      className="grid w-3.5 shrink-0 place-items-center"
      data-review-state={normalized}
      title={label}
    >
      <ReviewStatusMark status={normalized} />
    </span>
  );
}

function ReviewStatusMark({ status }: { status: ReviewStatus }) {
  if (status === 'reviewed')
    return <CheckIcon className="size-3.5 text-graph-2" />;
  if (status === 'stale')
    return <RotateCcwIcon className="size-3 text-graph-4" />;
  return <span className="size-1.5 rounded-full bg-muted-foreground/60" />;
}

function reviewStatusLabel(status: ReviewStatus | undefined) {
  if (status === 'reviewed') return 'Reviewed';
  if (status === 'stale') return 'Changed since review';
  return 'Not reviewed';
}
