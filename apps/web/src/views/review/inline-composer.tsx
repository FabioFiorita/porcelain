import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { CommentAnchor } from '../../domain/comments';
import type { ReviewScope } from '../../domain/review';
import { useCreateComment } from '../../query/comments';
import { reviewErrorMessage } from '../../query/review';
import { anchorLabel } from './thread-card';

export function InlineComposer({
  scope,
  anchor,
  onClose,
}: {
  scope: ReviewScope;
  anchor: CommentAnchor;
  onClose: () => void;
}) {
  const id = useId();
  const [body, setBody] = useState('');
  const mutation = useCreateComment(scope);
  const valid = body.trim().length > 0 && !body.includes('\0');
  const submit = async () => {
    if (!valid || mutation.isPending) return;
    try {
      await mutation.submit({ anchor, body });
      onClose();
    } catch {
      /* Retain the draft; the mutation supplies the error. */
    }
  };
  return (
    <form
      className="m-3 flex flex-col gap-2 rounded-lg border bg-card p-3 font-sans"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {anchor.filePath} · {anchorLabel(anchor)}
      </label>
      <Textarea
        id={id}
        autoFocus
        aria-label="Comment"
        placeholder="Share feedback…"
        value={body}
        maxLength={16000}
        disabled={mutation.isPending}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            void submit();
          }
          if (event.key === 'Escape' && !mutation.isPending) {
            event.stopPropagation();
            onClose();
          }
        }}
      />
      {mutation.error && (
        <p role="alert" className="text-xs text-destructive">
          {reviewErrorMessage(mutation.error)}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={mutation.isPending}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!valid || mutation.isPending}>
          {mutation.isPending ? 'Posting…' : 'Post comment'}
        </Button>
      </div>
    </form>
  );
}
