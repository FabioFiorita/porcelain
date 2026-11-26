import { useState, type ReactNode } from 'react';
import {
  commentSpread,
  draftCountLabel,
  openComments,
  postedComments,
} from '@porcelain/client/comments/rules';
import { useComments, type CommentOwner } from '../queries/comments';
import { CommentsDialog } from './comments-dialog';

export function CommentsSummary({ owner }: { owner: CommentOwner }) {
  const { view } = useComments(owner);
  const [open, setOpen] = useState(false);
  const comments = openComments(view);
  const count = comments.length;
  const posted = postedComments(view).length;
  const label = draftCountLabel(count);
  const row = (text: ReactNode, action: string) => (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="-mx-2 flex min-h-7 items-baseline gap-2 rounded-md px-2 py-1 text-left text-ui hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="min-w-0 flex-1">{text}</span>
      <span className="shrink-0 text-caption text-muted-foreground">
        {action}
      </span>
    </button>
  );
  return (
    <>
      {count > 0 &&
        row(
          <>
            {label}
            <span className="text-muted-foreground">
              {' '}
              · {commentSpread(comments)}
            </span>
          </>,
          'Review and publish',
        )}
      {count === 0 &&
        posted > 0 &&
        row(
          <span className="text-muted-foreground">
            {posted === 1 ? '1 comment posted' : `${posted} comments posted`}
          </span>,
          'Show',
        )}
      {count === 0 && posted === 0 && (
        <p className="py-1 text-ui text-muted-foreground">None yet</p>
      )}
      <CommentsDialog owner={owner} open={open} onOpenChange={setOpen} />
    </>
  );
}
