import { useState, type ReactNode } from 'react';
import { openComments } from '@porcelain/client/comments/rules';
import { Button } from '@/components/ui/button';
import { useComments, type CommentOwner } from '../queries/comments';
import { CommentsDialog } from './comments-dialog';

function defaultTrigger(count: number, open: () => void) {
  return (
    <Button size="sm" variant="outline" onClick={open}>
      Publish review ({count})
    </Button>
  );
}

export function PublishReviewButton({
  owner,
  renderTrigger = defaultTrigger,
}: {
  owner: CommentOwner;
  renderTrigger?: (count: number, open: () => void) => ReactNode;
}) {
  const count = openComments(useComments(owner).view).length;
  const [open, setOpen] = useState(false);
  if (count === 0 && !open) return null;
  return (
    <>
      {count > 0 && renderTrigger(count, () => setOpen(true))}
      <CommentsDialog
        owner={owner}
        open={open}
        onOpenChange={setOpen}
        initialStep="publish"
      />
    </>
  );
}
