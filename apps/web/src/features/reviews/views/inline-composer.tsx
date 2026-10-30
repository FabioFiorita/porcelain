import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { type ChangeEvent, type KeyboardEvent, useId, useState } from 'react';
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

export type InlineCommentDraft = {
  body: string;
  pending?:
    | { body: string; anchor: string; threadId: string; messageId: string }
    | undefined;
};

type DraftControl =
  | {
      draft: InlineCommentDraft;
      onDraftChange: (draft: InlineCommentDraft) => void;
    }
  | { draft?: never; onDraftChange?: never };

export function InlineComposer({
  scope,
  context,
  anchor,
  onClose,
  quote,
  draft: controlledDraft,
  onDraftChange,
  variant = 'comment',
  autoFocus = true,
  closable = true,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  anchor: CommentAnchor;
  onClose: () => void;
  quote?: string | undefined;
  variant?: 'comment' | 'answer';
  autoFocus?: boolean;
  closable?: boolean;
} & DraftControl) {
  const id = useId();
  const [localDraft, setLocalDraft] = useState<InlineCommentDraft>({
    body: '',
  });
  const draft = controlledDraft ?? localDraft;
  const setDraft = onDraftChange ?? setLocalDraft;
  const { body, pending } = draft;
  const anchorKey = JSON.stringify(anchor);
  const mutation = useCreateComment(scope, context);
  const message = quote === undefined ? body : questionAnswer(quote, body);
  const quoteLength = message.length - body.length;
  const valid = commentBodyValid(body) && commentBodyValid(message);
  const submit = () => {
    if (!valid || mutation.result.waiting) return;
    const intent = retainIntent(
      pending?.anchor === anchorKey ? pending : undefined,
      message,
      () => ({
        body: message,
        anchor: anchorKey,
        threadId: crypto.randomUUID(),
        messageId: crypto.randomUUID(),
      }),
    );
    setDraft({ ...draft, pending: intent });
    mutation.send(
      {
        anchor,
        body: message,
        threadId: intent.threadId,
        messageId: intent.messageId,
        ...(scope.review ? { reviewRevision: scope.review.revision } : {}),
      },
      () => {
        setDraft({ body: '', pending: undefined });
        onClose();
      },
    );
  };
  const answer = variant === 'answer';
  const field = {
    id,
    autoFocus,
    value: body,
    maxLength: Math.max(0, mutation.bodyLimit - quoteLength),
    disabled: mutation.result.waiting,
    onChange: (event: ChangeEvent<HTMLTextAreaElement>) => {
      setDraft({ body: event.target.value, pending: undefined });
    },
    onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
      if (closable && event.key === 'Escape' && !mutation.result.waiting) {
        event.stopPropagation();
        onClose();
      }
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
        submit();
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
              anchorPath(anchor),
              anchorLabel(anchor),
              anchor.kind === 'change' &&
              anchor.revision !== null &&
              anchor.revision !== undefined
                ? `at ${shortOid(anchor.revision)}`
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
              onClick={onClose}
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
            onClick={onClose}
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
