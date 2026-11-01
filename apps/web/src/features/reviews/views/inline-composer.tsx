import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useAtom } from '@effect/atom-react';
import { type ChangeEvent, type KeyboardEvent, type Ref, useId } from 'react';
import { ArrowUpIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { shortOid } from '@porcelain/client/history/rules';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/shared/lib/utils';
import { useCreateComment } from '../commands/comments';
import {
  type CommentAnchor,
  anchorLabel,
  anchorPath,
  commentBodyValid,
  questionAnswer,
  retainIntent,
} from '@porcelain/client/reviews/rules';
import {
  reviewErrorMessage,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { commentDraftKey, newCommentDraftState } from '../store';
import { commentKeyDown } from '../adapters/comment-keyboard';

export function InlineComposer({
  scope,
  context,
  anchor,
  onClose,
  quote,
  questionId,
  variant = 'comment',
  autoFocus = true,
  closable = true,
  inputRef,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  anchor: CommentAnchor;
  onClose: () => void;
  quote?: string | undefined;
  questionId?: string | undefined;
  variant?: 'comment' | 'answer';
  autoFocus?: boolean;
  closable?: boolean;
  inputRef?: Ref<HTMLTextAreaElement>;
}) {
  const id = useId();
  const [draft, setDraft] = useAtom(
    newCommentDraftState(
      commentDraftKey(context.connection.environmentId, scope, {
        kind: 'create',
        anchor,
        quote,
        questionId,
      }),
    ),
  );
  const { body, pending } = draft;
  const mutation = useCreateComment(scope, context);
  const message = quote === undefined ? body : questionAnswer(quote, body);
  const target = pending?.body === message ? pending.anchor : anchor;
  const quoteLength = message.length - body.length;
  const valid = commentBodyValid(body) && commentBodyValid(message);
  const cancel = () => {
    if (mutation.result.waiting) return;
    setDraft({ body: '' });
    onClose();
  };
  const submit = (form: HTMLFormElement) => {
    if (!valid || mutation.result.waiting) return;
    const intent = retainIntent(pending, message, () => ({
      body: message,
      anchor,
      threadId: crypto.randomUUID(),
      messageId: crypto.randomUUID(),
      ...(scope.review ? { reviewRevision: scope.review.revision } : {}),
    }));
    setDraft({ ...draft, pending: intent });
    mutation.send(intent, () => {
      setDraft({ body: '', pending: undefined });
      if (form.isConnected) onClose();
    });
  };
  const answer = variant === 'answer';
  const field = {
    id,
    ref: inputRef,
    autoFocus,
    value: body,
    maxLength: Math.max(0, mutation.bodyLimit - quoteLength),
    disabled: mutation.result.waiting,
    onChange: (event: ChangeEvent<HTMLTextAreaElement>) => {
      setDraft({ body: event.target.value, pending: undefined });
    },
    onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => {
      commentKeyDown(
        event,
        mutation.result.waiting,
        closable ? cancel : undefined,
      );
    },
  };
  return (
    <form
      className={
        answer
          ? 'flex flex-col gap-1.5 font-sans'
          : 'm-3 flex flex-col gap-2 rounded-lg border bg-card p-3 font-sans'
      }
      onSubmit={(event) => {
        event.preventDefault();
        submit(event.currentTarget);
      }}
    >
      <label
        htmlFor={id}
        className={
          answer
            ? 'text-xs leading-4 font-medium text-muted-foreground'
            : 'text-xs text-muted-foreground'
        }
      >
        {answer
          ? 'Answer the agent'
          : [
              anchorPath(target),
              anchorLabel(target),
              target.kind === 'change' &&
              target.revision !== null &&
              target.revision !== undefined
                ? `at ${shortOid(target.revision)}`
                : undefined,
            ]
              .filter((part) => part !== null && part !== undefined)
              .join(' · ')}
      </label>
      {answer ? (
        <Textarea {...field} rows={4} placeholder="Your answer…" />
      ) : (
        <Textarea
          {...field}
          aria-label="Comment"
          placeholder="Share feedback…"
        />
      )}
      {AsyncResult.isFailure(mutation.result) && (
        <p role="alert" className="text-xs text-destructive">
          {reviewErrorMessage(Cause.squash(mutation.result.cause))}
        </p>
      )}
      {answer ? (
        <div className="flex items-center gap-2">
          <span className="text-xs leading-4 text-muted-foreground">
            via MCP
          </span>
          {closable && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              disabled={mutation.result.waiting}
              onClick={cancel}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            className={cn(!closable && 'ml-auto')}
            disabled={!valid || mutation.result.waiting}
          >
            <ArrowUpIcon />
            {mutation.result.waiting ? 'Sending…' : 'Send answer'}
          </Button>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={mutation.result.waiting}
            onClick={cancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!valid || mutation.result.waiting}
          >
            {mutation.result.waiting ? 'Posting…' : 'Comment'}
          </Button>
        </div>
      )}
    </form>
  );
}
