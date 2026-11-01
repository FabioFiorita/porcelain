import { TruncatedText } from '@/shared/views/truncated-text';
import { MessageSquareIcon } from 'lucide-react';
import {
  changeStatusMarks,
  type ChangeStatus,
} from '@porcelain/client/files/rules';
import { cn } from '@/shared/lib/utils';
import { copyText } from '@/shared/workspace/copy';
import { FileTreeIcon } from '@/features/files/index';
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
  changeStatus,
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
  changeStatus: ChangeStatus | undefined;
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
            aria-description={changeDescription(changeStatus, reviewStatus)}
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
            <ChangeStatusIcon
              status={changeStatus}
              reviewStatus={reviewStatus}
            />
            <FileTreeIcon path={path} className="size-3.5 shrink-0" />
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

export function ChangeStatusIcon({
  status,
  reviewStatus,
}: {
  status: ChangeStatus | undefined;
  reviewStatus: ReviewStatus | undefined;
}) {
  const normalized = reviewStatus ?? 'unreviewed';
  const label = changeDescription(status, reviewStatus);
  return (
    <span
      role="img"
      aria-label={label}
      className="grid w-3.5 shrink-0 place-items-center"
      data-review-state={normalized}
      data-change-status={status}
      title={label}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          status === undefined && 'bg-muted-foreground/60',
          (status === 'added' || status === 'untracked') && 'bg-graph-2',
          status === 'modified' && 'bg-graph-4',
          status === 'deleted' && 'bg-destructive',
          status === 'renamed' && 'bg-graph-1',
        )}
      />
    </span>
  );
}

function changeDescription(
  status: ChangeStatus | undefined,
  reviewStatus: ReviewStatus | undefined,
) {
  const changeLabel =
    status === undefined
      ? 'Change type unavailable'
      : changeStatusMarks[status].label;
  return `${changeLabel} · ${reviewStatusLabel(reviewStatus)}`;
}

function reviewStatusLabel(status: ReviewStatus | undefined) {
  if (status === 'reviewed') return 'Reviewed';
  if (status === 'stale') return 'Changed since review';
  return 'Not reviewed';
}
