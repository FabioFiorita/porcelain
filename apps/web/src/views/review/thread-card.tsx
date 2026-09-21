import { formatDistanceToNowStrict } from 'date-fns';
import { CheckIcon, RotateCcwIcon, SparklesIcon, UserIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
  MessageHeader,
} from '@/components/ui/message';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type {
  CommentAnchor,
  CommentAuthor,
  CommentMessage,
  CommentThread,
} from '../../domain/comments';
import type { ReviewScope } from '../../domain/review';
import { basename } from '../../domain/review';
import { discardRejection } from '../../lib/submit-form';
import { useReplyComment, useResolveComment } from '../../query/comments';
import { reviewErrorMessage } from '../../query/review';

const relative = (iso?: string) =>
  iso == null
    ? null
    : formatDistanceToNowStrict(new Date(iso), { addSuffix: true });

export function anchorLabel(anchor: CommentAnchor): string {
  if (anchor.kind === 'file') return 'Whole file';
  const sign = anchor.side === 'deletions' ? '−' : '+';
  return anchor.startLine === anchor.endLine
    ? `${sign}${anchor.startLine}`
    : `${sign}${anchor.startLine} to ${sign}${anchor.endLine}`;
}

function threadStarter(thread: CommentThread): CommentAuthor {
  return thread.messages[0]?.author ?? 'reviewer';
}

export type ThreadState = 'agent-replied' | 'awaiting-agent' | 'resolved';

function threadState(thread: CommentThread): ThreadState {
  if (thread.resolved) return 'resolved';
  return thread.messages.at(-1)?.author === 'agent'
    ? 'agent-replied'
    : 'awaiting-agent';
}

function threadStateLabel(thread: CommentThread): string {
  switch (threadState(thread)) {
    case 'resolved':
      return 'Resolved';
    case 'awaiting-agent':
      return 'Waiting for the agent';
    case 'agent-replied':
      return threadStarter(thread) === 'agent' && thread.messages.length === 1
        ? 'From the agent'
        : 'Agent replied';
  }
}

function AuthorAvatar({ author }: { author: CommentAuthor }) {
  const agent = author === 'agent';
  return (
    <MessageAvatar
      className={cn(
        'size-6 min-w-6',
        agent
          ? 'bg-foreground/10 text-foreground'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {agent ? (
        <SparklesIcon className="size-3.5" />
      ) : (
        <UserIcon className="size-3.5" />
      )}
    </MessageAvatar>
  );
}

function ThreadStarter({ thread }: { thread: CommentThread }) {
  const agent = threadStarter(thread) === 'agent';
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1',
        agent ? 'font-medium text-foreground' : 'text-muted-foreground',
      )}
    >
      {agent ? (
        <SparklesIcon className="size-3" />
      ) : (
        <UserIcon className="size-3" />
      )}
      {agent ? 'Agent' : 'You'}
    </span>
  );
}

/** One message rendered with the project's shadcn message and bubble primitives. */
function ThreadMessage({
  message,
  wide = false,
}: {
  message: Pick<CommentMessage, 'author' | 'body' | 'createdAt'>;
  wide?: boolean;
}) {
  const mine = message.author !== 'agent';
  const timestamp = relative(message.createdAt);
  return (
    <Message align={mine ? 'end' : 'start'}>
      {!wide && <AuthorAvatar author={message.author} />}
      <MessageContent className="gap-1">
        <MessageHeader className="gap-1.5 px-1 text-[11px]">
          {mine ? 'You' : 'Agent'}
          {timestamp != null && (
            <span className="font-normal">{timestamp}</span>
          )}
        </MessageHeader>
        <Bubble
          variant={mine ? 'tinted' : 'muted'}
          align={mine ? 'end' : 'start'}
          className={wide ? 'max-w-full' : 'max-w-[85%]'}
        >
          <BubbleContent className="rounded-2xl px-3 py-2 text-[12.5px] whitespace-pre-wrap">
            {message.body}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

/** A comment thread used by the Review surface and, when requested, its reveal link. */
export function ThreadCard({
  thread,
  scope,
  onReveal,
}: {
  thread: CommentThread;
  scope: ReviewScope;
  onReveal?: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState('');
  const pendingReply = useRef<{ body: string; messageId: string } | undefined>(
    undefined,
  );
  const reply = useReplyComment(scope);
  const resolve = useResolveComment(scope);
  const state = threadState(thread);
  const listed = onReveal != null;

  const where = listed ? (
    <button
      type="button"
      onClick={onReveal}
      title="Show in the code"
      className="flex min-w-0 items-center gap-1 rounded px-0.5 font-mono text-foreground hover:underline"
    >
      <span className="truncate">{basename(thread.anchor.filePath)}</span>
      <span className="shrink-0 font-sans text-muted-foreground">
        {anchorLabel(thread.anchor)}
      </span>
      {thread.anchor.revision != null && (
        <span className="shrink-0 text-muted-foreground">
          in {thread.anchor.revision.slice(0, 7)}
        </span>
      )}
    </button>
  ) : (
    <span>{anchorLabel(thread.anchor)}</span>
  );

  const resolveButton = (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-6 px-2 text-[11px]"
      disabled={resolve.isPending}
      onClick={() =>
        discardRejection(
          resolve.submit({ threadId: thread.id, resolved: !thread.resolved }),
        )
      }
    >
      {thread.resolved ? (
        <RotateCcwIcon data-icon="inline-start" />
      ) : (
        <CheckIcon data-icon="inline-start" />
      )}
      {thread.resolved ? 'Reopen' : 'Resolve'}
    </Button>
  );

  const resolveControl = (
    <span className="inline-flex min-w-0 items-center gap-1">
      {resolveButton}
      {resolve.error != null && (
        <span role="alert" className="max-w-64 text-[11px] text-destructive">
          {reviewErrorMessage(resolve.error)}
        </span>
      )}
    </span>
  );

  const replyForm = replying && (
    <form
      className="mt-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!body.trim() || body.includes('\0') || reply.isPending) return;
        const intent =
          pendingReply.current?.body === body
            ? pendingReply.current
            : { body, messageId: crypto.randomUUID() };
        pendingReply.current = intent;
        void reply
          .submit({
            threadId: thread.id,
            body,
            messageId: intent.messageId,
          })
          .then(() => {
            pendingReply.current = undefined;
            setBody('');
            setReplying(false);
          })
          .catch(() => undefined);
      }}
    >
      <FieldGroup className="gap-2">
        <Field>
          <FieldLabel htmlFor={`reply-${thread.id}`}>Reply</FieldLabel>
          <Textarea
            id={`reply-${thread.id}`}
            value={body}
            maxLength={16000}
            required
            disabled={reply.isPending}
            onChange={(event) => {
              pendingReply.current = undefined;
              setBody(event.target.value);
            }}
            placeholder="Add a reply…"
          />
        </Field>
        {reply.error != null && (
          <p role="alert" className="text-[11px] text-destructive">
            {reviewErrorMessage(reply.error)}
          </p>
        )}
        <div className="flex items-center gap-1">
          <Button
            type="submit"
            size="sm"
            disabled={reply.isPending || !body.trim() || body.includes('\0')}
          >
            {reply.isPending ? 'Replying…' : 'Post reply'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={reply.isPending}
            onClick={() => setReplying(false)}
          >
            Cancel
          </Button>
        </div>
      </FieldGroup>
    </form>
  );

  if (listed && !thread.resolved) {
    return (
      <article
        className="rounded-xl border bg-card p-3"
        aria-label="Comment thread"
      >
        <div className="mb-3 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <ThreadStarter thread={thread} />
          <span aria-hidden>·</span>
          {where}
        </div>
        {!expanded && thread.messages.length > 1 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mb-2 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
          >
            Show {thread.messages.length - 1} earlier
          </button>
        )}
        <MessageGroup className="gap-3">
          {(expanded ? thread.messages : thread.messages.slice(-1)).map(
            (message) => (
              <ThreadMessage key={message.id} message={message} wide />
            ),
          )}
        </MessageGroup>
        {replyForm}
        {!replying && (
          <div className="mt-3 flex items-center gap-1 border-t pt-2">
            <Badge
              variant={state === 'agent-replied' ? 'secondary' : 'outline'}
              className={cn(
                'h-4 px-1.5 text-[10px] font-normal',
                state === 'agent-replied' && 'text-foreground',
              )}
            >
              {threadStateLabel(thread)}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto h-6 px-2 text-[11px]"
              onClick={() => setReplying(true)}
            >
              Reply
            </Button>
            {resolveControl}
          </div>
        )}
      </article>
    );
  }

  if (thread.resolved) {
    return (
      <article
        className="flex min-w-0 items-center gap-2 rounded-lg border border-dashed px-2.5 py-1.5 text-[11.5px] text-muted-foreground"
        aria-label="Resolved comment thread"
      >
        <CheckIcon className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        {listed ? where : <ThreadStarter thread={thread} />}
        <span className="truncate">{thread.messages[0]?.body}</span>
        {resolveControl}
      </article>
    );
  }

  return (
    <article
      className="rounded-xl border bg-card p-3 shadow-sm"
      aria-label="Comment thread"
    >
      <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ThreadStarter thread={thread} />
        <span aria-hidden>·</span>
        <span>{where}</span>
        <Badge
          variant={state === 'agent-replied' ? 'secondary' : 'outline'}
          className="h-4 px-1.5 text-[10px] font-normal"
        >
          {threadStateLabel(thread)}
        </Badge>
        {!replying && (
          <div className="ml-auto flex gap-0.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={() => setReplying(true)}
            >
              Reply
            </Button>
            {resolveControl}
          </div>
        )}
      </div>
      <MessageGroup className="gap-3">
        {thread.messages.map((message) => (
          <ThreadMessage key={message.id} message={message} />
        ))}
      </MessageGroup>
      {replyForm}
      {state === 'awaiting-agent' && !replying && (
        <p className="mt-2 text-right text-[10.5px] text-muted-foreground">
          The agent reads this when you ask it to check its comments.
        </p>
      )}
    </article>
  );
}
