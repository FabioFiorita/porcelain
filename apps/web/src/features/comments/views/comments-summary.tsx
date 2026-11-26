import { useState } from 'react';
import { anchorPath, openComments } from '@porcelain/client/comments/rules';
import { useComments, type CommentOwner } from '../queries/comments';
import { CommentsDialog } from './comments-dialog';

function spread(comments: ReturnType<typeof openComments>) {
  const files = new Set(
    comments.flatMap((comment) => {
      const path = anchorPath(comment.anchor);
      return path === undefined ? [] : [path];
    }),
  ).size;
  const elsewhere = comments.filter(
    (comment) => anchorPath(comment.anchor) === undefined,
  ).length;
  return [
    files > 0 ? `on ${files} ${files === 1 ? 'file' : 'files'}` : '',
    elsewhere > 0 ? `${elsewhere} on the Walkthrough` : '',
  ]
    .filter(Boolean)
    .join(', ');
}

export function CommentsSummary({ owner }: { owner: CommentOwner }) {
  const { view } = useComments(owner);
  const [open, setOpen] = useState(false);
  const comments = openComments(view);
  const count = comments.length;
  const label = count === 1 ? '1 comment' : `${count} comments`;
  return (
    <>
      {count === 0 ? (
        <p className="py-1 text-ui text-muted-foreground">None yet</p>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="-mx-2 flex min-h-7 items-baseline gap-2 rounded-md px-2 py-1 text-left text-ui hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="min-w-0 flex-1">
            {label} not posted
            <span className="text-muted-foreground"> · {spread(comments)}</span>
          </span>
          <span className="shrink-0 text-caption text-muted-foreground">
            Review and publish
          </span>
        </button>
      )}
      <CommentsDialog owner={owner} open={open} onOpenChange={setOpen} />
    </>
  );
}
