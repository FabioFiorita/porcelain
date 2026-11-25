import { useState } from 'react';
import {
  commentCountsByPath,
  commentsAt,
  openComments,
} from '@porcelain/client/comments/rules';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useComments, type CommentOwner } from '../queries/comments';
import { CommentThread } from './comment-thread';
import { CommentsDialog } from './comments-dialog';

function FileCommentDialog({
  owner,
  path,
  onClose,
}: {
  owner: CommentOwner;
  path: string | undefined;
  onClose: () => void;
}) {
  const { view } = useComments(owner);
  const drafts =
    path === undefined
      ? []
      : commentsAt(
          view,
          (anchor) => anchor.kind === 'file' && anchor.path === path,
        );
  return (
    <Dialog
      open={path !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[min(92vw,34rem)]">
        <DialogHeader>
          <DialogTitle className="font-mono text-ui">{path}</DialogTitle>
        </DialogHeader>
        {path !== undefined && (
          <CommentThread
            owner={owner}
            drafts={drafts}
            anchor={{ kind: 'file', path }}
            composing
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function useFileComments(owner: CommentOwner) {
  const { view } = useComments(owner);
  const [path, setPath] = useState<string>();
  const [listOpen, setListOpen] = useState(false);
  const count = openComments(view).length;
  return {
    counts: commentCountsByPath(view),
    comment: (next: string) => setPath(next),
    summary:
      count > 0 ? (
        <div className="flex items-center gap-2 px-2 pb-1.5 text-2xs text-muted-foreground tabular-nums">
          <span className="min-w-0 flex-1">
            {count === 1 ? '1 comment' : `${count} comments`} not posted
          </span>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setListOpen(true)}
          >
            Review and publish
          </Button>
        </div>
      ) : null,
    dialogs: (
      <>
        <FileCommentDialog
          owner={owner}
          path={path}
          onClose={() => setPath(undefined)}
        />
        <CommentsDialog
          owner={owner}
          open={listOpen}
          onOpenChange={setListOpen}
        />
      </>
    ),
  };
}
