import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { relativeTime } from '@/shared/lib/relative-time';
import {
  CheckIcon,
  EllipsisIcon,
  PencilIcon,
  RotateCcwIcon,
  SparklesIcon,
  Trash2Icon,
  UserIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
  MessageHeader,
} from '@/components/ui/message';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/shared/lib/utils';
import {
  useDeleteComment,
  useEditComment,
  useReplyComment,
  useResolveComment,
} from '../commands/comments';
import {
  anchorLabel,
  type CommentMessageAuthor,
  commentBodyValid,
  type CommentMessage,
  type CommentThread,
  retainIntent,
  threadStarter,
  threadState,
  threadStateLabel,
} from '@porcelain/client/reviews/rules';
import {
  basename,
  reviewErrorMessage,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';

const relative = (iso?: string) => (iso == null ? null : relativeTime(iso));

function AuthorAvatar({ author }: { author: CommentMessageAuthor }) {
  const agent = author === 'agent';
  return (
    <MessageAvatar className={cn('size-6 min-w-6', agent ? ' ' : ' ')}>
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

type MessageOwner = {
  scope: ReviewScope;
  context: ConnectionContext;
  threadId: string;
};

function MessageMenu({
  owner,
  messageId,
  onEdit,
}: {
  owner: MessageOwner;
  messageId: string;
  onEdit: () => void;
}) {
  const remove = useDeleteComment(owner.scope, owner.context);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Comment actions"
              disabled={remove.result.waiting}
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <PencilIcon />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => remove.send({ threadId: owner.threadId, messageId })}
          >
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {AsyncResult.isFailure(remove.result) && (
        <span role="alert" className="font-normal text-destructive">
          {reviewErrorMessage(Cause.squash(remove.result.cause))}
        </span>
      )}
    </>
  );
}

function MessageEditor({
  owner,
  message,
  onDone,
}: {
  owner: MessageOwner;
  message: Pick<CommentMessage, 'id' | 'body'>;
  onDone: () => void;
}) {
  const [body, setBody] = useState(message.body);
  const edit = useEditComment(owner.scope, owner.context);
  const valid = commentBodyValid(body);
  return (
    <form
      className="flex w-full flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid || edit.result.waiting) return;
        edit.send(
          { threadId: owner.threadId, messageId: message.id, body },
          onDone,
        );
      }}
    >
      <Textarea
        autoFocus
        aria-label="Edit comment"
        value={body}
        maxLength={edit.bodyLimit}
        disabled={edit.result.waiting}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onDone();
        }}
      />
      {AsyncResult.isFailure(edit.result) && (
        <p role="alert" className="text-[11px] text-destructive">
          {reviewErrorMessage(Cause.squash(edit.result.cause))}
        </p>
      )}
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={edit.result.waiting}
          onClick={onDone}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={edit.result.waiting || !valid}
        >
          {edit.result.waiting ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

function ThreadMessage({
  message,
  owner,
  wide = false,
}: {
  message: Pick<
    CommentMessage,
    'id' | 'author' | 'body' | 'createdAt' | 'editedAt'
  >;
  owner: MessageOwner;
  wide?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const mine = message.author !== 'agent';
  const timestamp = relative(message.createdAt);
  return (
    <Message align={mine ? 'end' : 'start'}>
      {!wide && <AuthorAvatar author={message.author} />}
      <MessageContent>
        <MessageHeader>
          {mine ? 'You' : 'Agent'}
          {timestamp != null && (
            <span className="font-normal">{timestamp}</span>
          )}
          {message.editedAt != null && (
            <span className="font-normal">edited</span>
          )}
          {mine && !editing && (
            <MessageMenu
              owner={owner}
              messageId={message.id}
              onEdit={() => setEditing(true)}
            />
          )}
        </MessageHeader>
        {editing ? (
          <MessageEditor
            owner={owner}
            message={message}
            onDone={() => setEditing(false)}
          />
        ) : (
          <Bubble
            variant={mine ? 'tinted' : 'muted'}
            align={mine ? 'end' : 'start'}
            className={wide ? 'max-w-full' : 'max-w-[85%]'}
          >
            <BubbleContent className="whitespace-pre-wrap">
              {message.body}
            </BubbleContent>
          </Bubble>
        )}
      </MessageContent>
    </Message>
  );
}

export function ThreadCard({
  thread,
  scope,
  context,
  onReveal,
}: {
  thread: CommentThread;
  scope: ReviewScope;
  context: ConnectionContext;
  onReveal?: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState('');
  const pendingReply = useRef<{ body: string; messageId: string } | undefined>(
    undefined,
  );
  const reply = useReplyComment(scope, context);
  const resolve = useResolveComment(scope, context);
  const state = threadState(thread);
  const listed = onReveal != null;
  const owner = { scope, context, threadId: thread.id };

  const where = listed ? (
    <button
      type="button"
      onClick={onReveal}
      title={
        thread.anchor.kind === 'change' ? 'Show the change' : 'Show in the code'
      }
      className="flex min-w-0 items-center gap-1 rounded px-0.5 font-mono text-foreground hover:underline"
    >
      {thread.anchor.kind !== 'change' && (
        <span className="truncate">{basename(thread.anchor.filePath)}</span>
      )}
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
      className="h-6"
      disabled={resolve.result.waiting}
      onClick={() =>
        resolve.send({ threadId: thread.id, resolved: !thread.resolved })
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
      {AsyncResult.isFailure(resolve.result) && (
        <span role="alert" className="max-w-64 text-[11px] text-destructive">
          {reviewErrorMessage(Cause.squash(resolve.result.cause))}
        </span>
      )}
    </span>
  );

  const replyForm = replying && (
    <form
      className="mt-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!commentBodyValid(body) || reply.result.waiting) return;
        const intent = retainIntent(pendingReply.current, body, () => ({
          body,
          messageId: crypto.randomUUID(),
        }));
        pendingReply.current = intent;
        reply.send(
          { threadId: thread.id, body, messageId: intent.messageId },
          () => {
            pendingReply.current = undefined;
            setBody('');
            setReplying(false);
          },
        );
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`reply-${thread.id}`}>Reply</FieldLabel>
          <Textarea
            id={`reply-${thread.id}`}
            value={body}
            maxLength={reply.bodyLimit}
            required
            disabled={reply.result.waiting}
            onChange={(event) => {
              pendingReply.current = undefined;
              setBody(event.target.value);
            }}
            placeholder="Add a reply…"
          />
        </Field>
        {AsyncResult.isFailure(reply.result) && (
          <p role="alert" className="text-[11px] text-destructive">
            {reviewErrorMessage(Cause.squash(reply.result.cause))}
          </p>
        )}
        <div className="flex items-center gap-1">
          <Button
            type="submit"
            size="sm"
            disabled={reply.result.waiting || !commentBodyValid(body)}
          >
            {reply.result.waiting ? 'Replying…' : 'Post reply'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={reply.result.waiting}
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
        <MessageGroup>
          {(expanded ? thread.messages : thread.messages.slice(-1)).map(
            (message) => (
              <ThreadMessage
                key={message.id}
                message={message}
                owner={owner}
                wide
              />
            ),
          )}
        </MessageGroup>
        {replyForm}
        {!replying && (
          <div className="mt-3 flex items-center gap-1 border-t pt-2">
            <Badge
              variant={state === 'agent-replied' ? 'secondary' : 'outline'}
              className={cn('h-4   ', state === 'agent-replied' && '')}
            >
              {threadStateLabel(thread)}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto h-6"
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
        <CheckIcon className="size-3.5 shrink-0 text-graph-2" />
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
          className="h-4"
        >
          {threadStateLabel(thread)}
        </Badge>
        {!replying && (
          <div className="ml-auto flex gap-0.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6"
              onClick={() => setReplying(true)}
            >
              Reply
            </Button>
            {resolveControl}
          </div>
        )}
      </div>
      <MessageGroup>
        {thread.messages.map((message) => (
          <ThreadMessage key={message.id} message={message} owner={owner} />
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
