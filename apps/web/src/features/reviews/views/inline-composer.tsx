import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCreateComment } from '../commands/comments';
import {
  type CommentAnchor,
  anchorLabel,
  commentBodyValid,
  retainIntent,
} from '../rules/comments';
import { reviewErrorMessage, type ReviewScope } from '../rules/review';
import type { ReviewsContext } from '../rules/reviewed';

export function InlineComposer({
  scope,
  context,
  anchor,
  onClose,
}: {
  scope: ReviewScope;
  context: ReviewsContext;
  anchor: CommentAnchor;
  onClose: () => void;
}) {
  const id = useId();
  const [body, setBody] = useState('');
  const pending = useRef<
    { body: string; threadId: string; messageId: string } | undefined
  >(undefined);
  const mutation = useCreateComment(scope, context);
  const valid = commentBodyValid(body);
  const submit = () => {
    if (!valid || mutation.isPending) return;
    const intent = retainIntent(pending.current, body, () => ({
      body,
      threadId: crypto.randomUUID(),
      messageId: crypto.randomUUID(),
    }));
    pending.current = intent;
    mutation.run(
      {
        anchor,
        body,
        threadId: intent.threadId,
        messageId: intent.messageId,
      },
      () => {
        pending.current = undefined;
        onClose();
      },
    );
  };
  return (
    <form
      className="m-3 flex flex-col gap-2 rounded-lg border bg-card p-3 font-sans"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
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
        maxLength={mutation.bodyLimit}
        disabled={mutation.isPending}
        onChange={(event) => {
          pending.current = undefined;
          setBody(event.target.value);
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            submit();
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
          {mutation.isPending ? 'Posting…' : 'Comment'}
        </Button>
      </div>
    </form>
  );
}
