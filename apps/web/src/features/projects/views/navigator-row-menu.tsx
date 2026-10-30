import { useState, type ReactNode } from 'react';
import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
import type { NavigatorEntry } from '@porcelain/client/projects/rules';
import { readReviewPullRequest } from '@porcelain/client/reviews';
import { reviewPullRequestNotice } from '@porcelain/client/reviews/rules';
import type { Connection } from '@/shared/workspace/connection';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ArchiveReview } from './archive-review';

export function NavigatorRowMenu({
  entry,
  connection,
  onRetry,
  beforeLeave,
  children,
}: {
  entry: NavigatorEntry;
  connection: Connection;
  onRetry: () => void;
  beforeLeave: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const review = entry.review.state === 'available' ? entry.review : undefined;
  if (!review?.pullRequestNumber) return children;
  return (
    <ContextMenu open={open} onOpenChange={setOpen}>
      <ContextMenuTrigger render={<div className="min-w-0 flex-1" />}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        {open && (
          <ReviewActions
            connection={connection}
            reviewId={review.reviewId}
            archived={review.archived}
            beforeLeave={beforeLeave}
            onRetry={onRetry}
          />
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function ReviewActions({
  connection,
  reviewId,
  archived,
  beforeLeave,
  onRetry,
}: {
  connection: Connection;
  reviewId: string;
  archived: boolean;
  beforeLeave: () => void;
  onRetry: () => void;
}) {
  const query = readReviewPullRequest({ connection, reviewId });
  const result = useAtomValue(query);
  const retry = useAtomRefresh(query);
  const pull = Option.getOrUndefined(AsyncResult.value(result));
  const issue = reviewPullRequestNotice(
    AsyncResult.isFailure(result) ? { kind: 'failed' } : pull,
  );
  return (
    <ContextMenuGroup>
      {issue && (
        <ContextMenuLabel className="max-w-72 whitespace-normal break-words">
          {issue}
        </ContextMenuLabel>
      )}
      <ContextMenuItem
        onClick={() => {
          retry();
          onRetry();
        }}
      >
        Read pull request again
      </ContextMenuItem>
      {!archived &&
        pull?.kind === 'available' &&
        (pull.pullRequest.state === 'merged' ||
          pull.pullRequest.state === 'closed') && (
          <ArchiveReview
            connection={connection}
            reviewId={reviewId}
            beforeLeave={beforeLeave}
            menuItem
          />
        )}
    </ContextMenuGroup>
  );
}
