import { formatDistanceToNowStrict } from 'date-fns';
import { Check, MessagesSquare, RotateCcw, Sparkles, User } from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
  MessageHeader,
} from '@/components/ui/message';
import { cn } from '@/lib/utils';
import type { CommentMessage } from '../../contracts/comments';
import {
  type CommentAuthor,
  type CommentThread,
  locationLabel,
  threadPath,
  threadStarter,
  threadState,
} from '../../domain/comments';
import { ordinal } from '../../domain/history';
import { basename, type ReviewScope } from '../../domain/review';
import { useReplyToComment, useResolveComment } from '../../query/comments';
import { reportFailure } from '../workspace/notify';
import { InlineComposer } from './inline-composer';
import { MarkdownView } from './markdown-view';
import { threadStateLabel, useSeenWhenRead } from './thread-state';

const relative = (iso?: string) =>
  iso == null
    ? null
    : formatDistanceToNowStrict(new Date(iso), { addSuffix: true });

function AuthorAvatar({
  author,
  className,
}: {
  author: CommentAuthor;
  className?: string;
}) {
  const agent = author === 'agent';
  return (
    <MessageAvatar
      className={cn(
        'size-6 min-w-6',
        agent
          ? 'bg-foreground/10 text-foreground'
          : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {agent ? (
        <Sparkles className="size-3.5" />
      ) : (
        <User className="size-3.5" />
      )}
    </MessageAvatar>
  );
}

/** Who opened the thread, first in every header, so the agent's notes stand out at a glance. */
export function ThreadStarter({ thread }: { thread: CommentThread }) {
  const agent = threadStarter(thread) === 'agent';
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1',
        agent ? 'font-medium text-foreground' : 'text-muted-foreground',
      )}
    >
      {agent ? <Sparkles className="size-3" /> : <User className="size-3" />}
      {agent ? 'Agent' : 'You'}
    </span>
  );
}

/** A small yellow dot: an agent message the reviewer has not read yet. */
function UnseenMarker() {
  return (
    <span
      role="img"
      aria-label="New from the agent"
      title="New from the agent"
      className="size-2 shrink-0 rounded-full bg-amber-400 ring-2 ring-amber-400/25"
    />
  );
}

/** Comment bodies are Markdown, rendered without raw HTML, tight enough for a bubble. */
function MessageBody({ body }: { body: string }) {
  return (
    <MarkdownView
      text={body}
      className="text-[12.5px] leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
    />
  );
}

/**
 * One message in shadcn's chat shape: the reviewer on the right, the agent on
 * the left, so a thread reads as the conversation it is.
 */
export function ThreadMessage({
  message,
  wide = false,
}: {
  message: Pick<CommentMessage, 'author' | 'body' | 'createdAt'>;
  /** In a narrow column the bubble takes the whole width instead of wrapping into a tall strip. */
  wide?: boolean;
}) {
  const mine = message.author !== 'agent';
  return (
    <Message align={mine ? 'end' : 'start'}>
      {/* The narrow list already names who wrote each message; the avatar only costs width there. */}
      {!wide && <AuthorAvatar author={message.author} />}
      <MessageContent className="min-w-0 gap-1">
        <MessageHeader className="gap-1.5 px-1 text-[11px]">
          {mine ? 'You' : 'Agent'}
          <span className="font-normal">{relative(message.createdAt)}</span>
        </MessageHeader>
        <Bubble
          variant={mine ? 'tinted' : 'muted'}
          align={mine ? 'end' : 'start'}
          className={wide ? 'max-w-full' : 'max-w-[85%]'}
        >
          <BubbleContent className="min-w-0 rounded-2xl px-3 py-2">
            <MessageBody body={message.body} />
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

/** An outdated thread keeps the lines it was about, as they were. */
function SnapshotBlock({
  snapshot,
}: {
  snapshot: NonNullable<CommentThread['snapshot']>;
}) {
  const lines = snapshot.text.split('\n');
  return (
    <figure className="mb-3">
      <figcaption className="mb-1 text-[10.5px] text-muted-foreground">
        The code as it was
      </figcaption>
      <pre className="overflow-x-auto rounded-md border bg-muted/40 py-1.5 font-mono text-[11px] leading-[1.6]">
        {lines.map((line, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the key is the line number
          <div key={snapshot.startLine + index} className="flex">
            <span className="w-9 shrink-0 pr-2 text-right text-muted-foreground/70 select-none">
              {snapshot.startLine + index}
            </span>
            <span className="pr-3 whitespace-pre">{line}</span>
          </div>
        ))}
      </pre>
    </figure>
  );
}

/** "file.ts +12 to +14", "file.ts Outdated", "General". */
function Where({
  thread,
  onReveal,
}: {
  thread: CommentThread;
  onReveal?: () => void;
}) {
  const path = threadPath(thread);
  const revision =
    thread.anchor.kind === 'worktree' ? undefined : thread.anchor.revision;
  const parent =
    thread.anchor.kind === 'worktree' ? undefined : thread.anchor.parent;
  if (path == null) {
    return (
      <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
        <MessagesSquare className="size-3 shrink-0" />
        General
      </span>
    );
  }
  const outdated = thread.location?.state === 'outdated';
  const content = (
    <>
      <span className="truncate font-mono">{basename(path)}</span>
      <span
        className={cn(
          'shrink-0 font-sans text-muted-foreground',
          outdated && 'text-amber-700 dark:text-amber-300',
        )}
      >
        {locationLabel(thread)}
      </span>
      {revision != null && (
        <span className="shrink-0 font-sans text-muted-foreground">
          in {revision.slice(0, 7)}
          {parent != null && parent > 1 && `, ${ordinal(parent)} parent`}
        </span>
      )}
    </>
  );
  // An outdated thread has no code to jump to; its snapshot shows what it was about.
  if (onReveal == null || outdated) {
    return (
      <span
        className="flex min-w-0 items-center gap-1 px-0.5 text-foreground"
        title={path}
      >
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onReveal}
      title={`Show in the code: ${path}`}
      className="flex min-w-0 items-center gap-1 rounded px-0.5 text-foreground hover:underline"
    >
      {content}
    </button>
  );
}

/**
 * A thread and its replies, from either side. Inline it sits under the lines it
 * is about; in the Comments list (`onReveal`) it names its place, which jumps to
 * the code, and keeps its actions at the bottom where the narrow column has room.
 */
export function ThreadCard({
  thread,
  scope,
  onReveal,
  listed = onReveal != null,
}: {
  thread: CommentThread;
  scope: ReviewScope;
  onReveal?: () => void;
  /** The Comments list shape; general threads are listed without a place to reveal. */
  listed?: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const reply = useReplyToComment(scope);
  const resolve = useResolveComment(scope);
  const seen = useSeenWhenRead(scope, thread, card);
  const state = threadState(thread);

  const reveal =
    onReveal == null
      ? undefined
      : () => {
          seen.mark();
          onReveal();
        };

  const resolveButton = (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 px-2 text-[11px]"
      disabled={resolve.isPending}
      onClick={() =>
        reportFailure(
          resolve.submit({ threadId: thread.id, resolved: true }),
          'The thread was not resolved',
        )
      }
    >
      <Check className="size-3" />
      Resolve
    </Button>
  );

  const startReply = () => {
    seen.mark();
    setReplying(true);
  };

  const composer = replying && (
    <div className="mt-3">
      <InlineComposer
        label="Reply"
        submitLabel="Reply"
        placeholder="Reply…"
        pending={reply.isPending}
        onCancel={() => setReplying(false)}
        onSubmit={(body) => {
          reportFailure(
            reply
              .submit({ threadId: thread.id, body })
              .then(() => setReplying(false)),
            'The reply was not posted',
          );
        }}
      />
    </div>
  );

  const snapshot = thread.location?.state === 'outdated' &&
    thread.snapshot != null && <SnapshotBlock snapshot={thread.snapshot} />;

  if (thread.resolved) {
    return (
      <div
        ref={card}
        className="diff-annotation flex min-w-0 items-center gap-2 rounded-lg border border-dashed px-2.5 py-1.5 text-[11.5px] text-muted-foreground"
      >
        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        {listed ? (
          <Where thread={thread} onReveal={reveal} />
        ) : (
          <ThreadStarter thread={thread} />
        )}
        <span className="min-w-0 truncate">
          {listed
            ? thread.messages[0]?.body
            : `Resolved: ${thread.messages[0]?.body}`}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-6 shrink-0 px-2 text-[11px]"
          disabled={resolve.isPending}
          onClick={() =>
            reportFailure(
              resolve.submit({ threadId: thread.id, resolved: false }),
              'The thread was not reopened',
            )
          }
        >
          <RotateCcw className="size-3" />
          Reopen
        </Button>
      </div>
    );
  }

  if (listed) {
    return (
      <div ref={card} className="rounded-xl border bg-card p-3">
        <div className="mb-3 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <ThreadStarter thread={thread} />
          <span aria-hidden>·</span>
          <Where thread={thread} onReveal={reveal} />
          {seen.unseen && (
            <span className="ml-auto flex shrink-0 items-center">
              <UnseenMarker />
            </span>
          )}
        </div>
        {snapshot}
        {/* The narrow column shows where the thread stands; the earlier turns are one click away. */}
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
        {composer}
        {!replying && (
          <div className="mt-3 flex items-center gap-1 border-t pt-2">
            <Badge
              variant={state === 'agent-replied' ? 'secondary' : 'outline'}
              className={cn(
                'h-4 min-w-0 truncate px-1.5 text-[10px] font-normal',
                state === 'agent-replied' && 'text-foreground',
              )}
            >
              {threadStateLabel(thread)}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-6 px-2 text-[11px]"
              onClick={startReply}
            >
              Reply
            </Button>
            {resolveButton}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={card}
      className="diff-annotation rounded-xl border bg-card p-3 shadow-sm"
    >
      <div className="mb-2 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        <ThreadStarter thread={thread} />
        <span aria-hidden>·</span>
        <span className="shrink-0">{locationLabel(thread)}</span>
        <Badge
          variant={state === 'agent-replied' ? 'secondary' : 'outline'}
          className={cn(
            'h-4 px-1.5 text-[10px] font-normal',
            state === 'agent-replied' && 'text-foreground',
          )}
        >
          {threadStateLabel(thread)}
        </Badge>
        {seen.unseen && <UnseenMarker />}
        <div className="ml-auto flex gap-0.5">
          {!replying && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={startReply}
            >
              Reply
            </Button>
          )}
          {resolveButton}
        </div>
      </div>

      <MessageGroup className="gap-3">
        {thread.messages.map((message) => (
          <ThreadMessage key={message.id} message={message} />
        ))}
      </MessageGroup>

      {state === 'awaiting-agent' && !replying && (
        // Honest about delivery: the agent only reads threads when told to, through MCP.
        <p className="mt-2 text-right text-[10.5px] text-muted-foreground">
          The agent reads this when you ask it to check its comments.
        </p>
      )}

      {composer}
    </div>
  );
}
