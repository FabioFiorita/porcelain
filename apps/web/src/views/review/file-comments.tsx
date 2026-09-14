import { MessageSquare, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import type { CommentThread } from '../../domain/comments';
import type { ReviewScope } from '../../domain/review';
import { discardRejection } from '../../lib/submit-form';
import {
  useComments,
  useCreateComment,
  useReplyComment,
  useResolveComment,
} from '../../query/comments';
import { reviewErrorMessage } from '../../query/review';
import { ReviewBoundary } from './review-boundary';

export function FileComments({
  scope,
  path,
}: {
  scope: ReviewScope;
  path: string;
}) {
  return (
    <ReviewBoundary key={`${scope.worktreeId}:${path}`}>
      <FileDiscussion scope={scope} path={path} />
    </ReviewBoundary>
  );
}

function FileDiscussion({ scope, path }: { scope: ReviewScope; path: string }) {
  const discussion = useComments(scope);
  const threads = discussion.threads.filter(
    (thread) =>
      thread.anchor.kind === 'file' &&
      thread.anchor.filePath === path &&
      // Revision-specific comments are not safe to associate with the current
      // file until a comparison identity exists in the anchor. Range anchors
      // are also hidden until staged/unstaged comparison identity is explicit.
      !thread.anchor.revision,
  );
  const [open, setOpen] = useState(false);
  const [compose, setCompose] = useState(false);
  const id = useId();
  return (
    <section aria-label="File comments" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          <MessageSquare />
          {threads.length} {threads.length === 1 ? 'comment' : 'comments'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(true);
            setCompose(true);
          }}
        >
          <Plus />
          Add comment
        </Button>
      </div>
      {open && (
        <div
          id={id}
          className="-m-1 flex max-h-96 flex-col gap-4 overflow-auto p-1"
        >
          {discussion.error && (
            <Alert variant="destructive">
              <AlertDescription>
                Discussion could not be updated. Comments shown may be out of
                date; Porcelain will retry when this window becomes active.
              </AlertDescription>
            </Alert>
          )}
          {threads.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No comments on this file yet.
            </p>
          )}
          {threads.map((thread) => (
            <ThreadCard key={thread.id} scope={scope} thread={thread} />
          ))}
          {compose && (
            <CommentComposer
              scope={scope}
              path={path}
              onDone={() => setCompose(false)}
            />
          )}
        </div>
      )}
    </section>
  );
}

export function ThreadCard({
  scope,
  thread,
}: {
  scope: ReviewScope;
  thread: CommentThread;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  return (
    <article
      className="flex flex-col gap-3 rounded-lg border bg-card p-4"
      aria-label="Comment thread"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {anchorLabel()}
        </span>
        {thread.resolved && <Badge variant="secondary">Resolved</Badge>}
        <ResolutionControl scope={scope} thread={thread} />
      </div>
      <MessageList messages={thread.messages} />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={replyOpen}
          onClick={() => setReplyOpen(!replyOpen)}
        >
          Reply
        </Button>
      </div>
      {replyOpen && (
        <ReplyComposer
          scope={scope}
          threadId={thread.id}
          onDone={() => setReplyOpen(false)}
        />
      )}
    </article>
  );
}

function anchorLabel() {
  // FileComments intentionally renders file anchors only. Range anchors do
  // not identify a staged or unstaged comparison yet.
  return 'File comment';
}

function MessageList({ messages }: { messages: CommentThread['messages'] }) {
  return (
    <div className="flex flex-col gap-2">
      {messages.map((message) => {
        const agent = message.author === 'agent';
        return (
          <div
            key={message.id}
            data-author={message.author}
            className={`flex flex-col gap-1 ${agent ? 'items-start' : 'items-end'}`}
          >
            <span className="px-2 text-[11px] font-medium text-muted-foreground">
              {agent ? 'Agent' : 'Reviewer'}
            </span>
            <p
              className={`max-w-[90%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${agent ? 'bg-muted text-foreground' : 'bg-primary/10 text-foreground'}`}
            >
              {message.body}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function ResolutionControl({
  scope,
  thread,
}: {
  scope: ReviewScope;
  thread: CommentThread;
}) {
  const mutation = useResolveComment(scope);
  return (
    <div className="flex shrink-0 items-center gap-2">
      {mutation.error && (
        <span role="alert" className="text-xs text-destructive">
          {reviewErrorMessage(mutation.error)}
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={mutation.isPending}
        aria-label={thread.resolved ? 'Unresolve comment' : 'Resolve comment'}
        title={thread.resolved ? 'Unresolve comment' : 'Resolve comment'}
        onClick={() =>
          discardRejection(
            mutation.submit({
              threadId: thread.id,
              resolved: !thread.resolved,
            }),
          )
        }
      >
        {thread.resolved ? 'Unresolve' : 'Resolve'}
      </Button>
    </div>
  );
}

function CommentComposer({
  scope,
  path,
  onDone,
}: {
  scope: ReviewScope;
  path: string;
  onDone: () => void;
}) {
  const [body, setBody] = useState('');
  const mutation = useCreateComment(scope);
  const id = useId();
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await mutation.submit({
            anchor: { kind: 'file', filePath: path },
            body,
          });
          onDone();
        } catch {
          // Keep the draft visible when saving fails.
        }
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={id}>Comment</FieldLabel>
          <Textarea
            id={id}
            value={body}
            maxLength={16000}
            required
            disabled={mutation.isPending}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Share feedback about this file…"
          />
        </Field>
        {mutation.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {reviewErrorMessage(mutation.error)}
            </AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={mutation.isPending || !body.trim() || body.includes('\0')}
          >
            {mutation.isPending ? 'Posting…' : 'Post comment'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={mutation.isPending}
            onClick={onDone}
          >
            Cancel
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

function ReplyComposer({
  scope,
  threadId,
  onDone,
}: {
  scope: ReviewScope;
  threadId: string;
  onDone: () => void;
}) {
  const [body, setBody] = useState('');
  const mutation = useReplyComment(scope);
  const id = useId();
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await mutation.submit({ threadId, body });
          onDone();
        } catch {
          // Keep the draft visible when saving fails.
        }
      }}
    >
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor={id}>Reply</FieldLabel>
          <Textarea
            id={id}
            value={body}
            maxLength={16000}
            required
            disabled={mutation.isPending}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add a reply…"
          />
        </Field>
        {mutation.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {reviewErrorMessage(mutation.error)}
            </AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={mutation.isPending || !body.trim() || body.includes('\0')}
          >
            {mutation.isPending ? 'Replying…' : 'Post reply'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={mutation.isPending}
            onClick={onDone}
          >
            Cancel
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
