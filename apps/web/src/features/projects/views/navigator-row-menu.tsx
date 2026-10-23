import type { ReactNode } from 'react';
import type { ReviewListEntry } from '@porcelain/client/reviews/rules';
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
  entry: ReviewListEntry;
  connection: Connection;
  onRetry: () => void;
  beforeLeave: () => void;
  children: ReactNode;
}) {
  if (!entry.reviewId || !entry.pullRequestNumber) return children;
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={<div className="flex min-w-0 flex-1 items-center" />}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="max-w-72">
        <ContextMenuGroup>
          {entry.pullRequestIssue && (
            <ContextMenuLabel className="whitespace-normal break-words">
              {entry.pullRequestIssue}
            </ContextMenuLabel>
          )}
          <ContextMenuItem onClick={onRetry}>
            Read pull request again
          </ContextMenuItem>
          {entry.archivable && (
            <ArchiveReview
              connection={connection}
              reviewId={entry.reviewId}
              beforeLeave={beforeLeave}
              menuItem
            />
          )}
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}
