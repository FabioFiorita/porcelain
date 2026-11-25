import { useState } from 'react';
import { openComments } from '@porcelain/client/comments/rules';
import { Button } from '@/components/ui/button';
import { useComments, type CommentOwner } from '../queries/comments';
import { CommentsDialog } from './comments-dialog';

export function useUnpublishedCount(owner: CommentOwner) {
  return openComments(useComments(owner).view).length;
}

export function PublishReviewButton({
  owner,
  label,
  variant = 'outline',
}: {
  owner: CommentOwner;
  label?: string;
  variant?: 'outline' | 'ghost';
}) {
  const count = useUnpublishedCount(owner);
  const [open, setOpen] = useState(false);
  if (count === 0) return null;
  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        {label ?? `Publish review (${count})`}
      </Button>
      <CommentsDialog
        owner={owner}
        open={open}
        onOpenChange={setOpen}
        initialStep="publish"
      />
    </>
  );
}
