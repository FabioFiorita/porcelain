import type { ReactNode } from 'react';
import { TruncatedText } from '@/shared/views/truncated-text';
import { CheckIcon, MessageSquareIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  changeStatusMarks,
  type ChangeStatus,
} from '@porcelain/client/files/rules';
import { cn } from '@/shared/lib/utils';
import { copyText } from '@/shared/workspace/copy';
import { FileTreeIcon } from '@/features/files/index';
import type { DocumentRef, OpenDocument } from '../rules/documents';
import { basename, type ReviewStatus } from '@porcelain/client/changes/rules';
import {
  reviewSidebarActions,
  type ReviewSidebarAction,
} from '@porcelain/client/changes/rules';
import { SidebarActionMenu } from './sidebar-action-menu';

export type ChangeRowExtra = {
  readonly trailing?: ReactNode;
  readonly tick?: boolean;
};

export const ROW =
  'flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-left text-caption transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60 aria-pressed:bg-selection aria-pressed:font-medium aria-pressed:text-foreground';

export function ChangeRow({
  path,
  document,
  note,
  scopes,
  changeStatus,
  reviewStatus,
  active,
  current = false,
  onOpen,
  sideLabel,
  onReview,
  canReview,
  writeBlock,
  onDiscard,
  indented = false,
  commentCount = 0,
  onComment,
  trailing,
  tick = false,
}: ChangeRowExtra & {
  path: string;
  document: DocumentRef;
  note: string | undefined;
  scopes: readonly string[];
  changeStatus: ChangeStatus | undefined;
  reviewStatus: ReviewStatus | undefined;
  active: boolean;
  current?: boolean;
  onOpen: OpenDocument;
  sideLabel: string;
  onReview: () => void;
  canReview: boolean;
  writeBlock?: string | undefined;
  onDiscard?: () => void;
  indented?: boolean;
  commentCount?: number | undefined;
  onComment?: () => void;
}) {
  const label = `${basename(path)}${scopes.length > 0 ? ` · ${scopes.join(' + ')}` : ''}`;
  const act = (id: ReviewSidebarAction['id']) => {
    switch (id) {
      case 'review':
        onReview();
        break;
      case 'open':
        onOpen(document);
        break;
      case 'open-to-side':
        onOpen(document, { toSide: true });
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
      case 'comment':
        onComment?.();
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
        canComment: onComment !== undefined,
      })}
      writeBlock={writeBlock}
      onAction={act}
    >
      {(menu) => (
        <div className="flex min-w-0 items-center">
          <button
            type="button"
            ref={(row) => {
              if (!row) return;
              if (!current) delete row.dataset.revealed;
              else if (row.dataset.revealed === undefined) {
                row.dataset.revealed = '';
                row.scrollIntoView({ block: 'nearest' });
              }
            }}
            aria-pressed={active}
            aria-current={current ? 'location' : undefined}
            aria-label={label}
            aria-description={changeDescription(changeStatus, reviewStatus)}
            title={
              note === null || note === undefined ? path : `${path}\n${note}`
            }
            className={cn(
              ROW,
              'flex-1 text-muted-foreground',
              indented && 'pl-7',
              active
                ? 'bg-selection font-medium text-foreground'
                : current && 'bg-accent text-foreground',
            )}
            onClick={(event) => onOpen(document, { toSide: event.altKey })}
          >
            <ChangeStatusIcon
              status={changeStatus}
              reviewStatus={reviewStatus}
              tick={tick}
            />
            <FileTreeIcon path={path} className="size-3.5 shrink-0" />
            <TruncatedText className="min-w-0 flex-1" text={basename(path)} />
            {commentCount > 0 && (
              <span
                aria-label={
                  commentCount === 1 ? '1 comment' : `${commentCount} comments`
                }
                className="flex shrink-0 items-center gap-0.5 text-2xs text-muted-foreground tabular-nums"
              >
                <MessageSquareIcon aria-hidden className="size-3" />
                {commentCount}
              </span>
            )}
            {trailing}
          </button>
          {tick && (
            <ReviewTick
              path={path}
              status={reviewStatus}
              canReview={canReview}
              writeBlock={writeBlock}
              onReview={onReview}
            />
          )}
          {menu}
        </div>
      )}
    </SidebarActionMenu>
  );
}

function ReviewTick({
  path,
  status,
  canReview,
  writeBlock,
  onReview,
}: {
  path: string;
  status: ReviewStatus | undefined;
  canReview: boolean;
  writeBlock: string | undefined;
  onReview: () => void;
}) {
  let hint = status === 'stale' ? 'Changed since reviewed' : 'Mark as reviewed';
  if (!canReview) hint = 'This file cannot be marked reviewed';
  if (writeBlock) hint = writeBlock;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Checkbox
            className="mx-1.5"
            checked={status === 'reviewed'}
            aria-label={`${path} reviewed`}
            aria-description={hint}
            disabled={!canReview || Boolean(writeBlock)}
            onCheckedChange={onReview}
          />
        }
      />
      <TooltipContent role="tooltip">{hint}</TooltipContent>
    </Tooltip>
  );
}

function ChangeStatusIcon({
  status,
  reviewStatus,
  tick,
}: {
  status: ChangeStatus | undefined;
  reviewStatus: ReviewStatus | undefined;
  tick: boolean;
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
      {normalized === 'reviewed' && !tick ? (
        <CheckIcon aria-hidden="true" className="size-3 text-add-fg" />
      ) : (
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
      )}
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
