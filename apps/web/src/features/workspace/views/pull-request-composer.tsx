import { useId, useState, type ReactNode } from 'react';
import { AsyncResult } from 'effect/reactivity';
import { PULL_REQUEST_COMMENT_CHARACTERS } from '@porcelain/client/projects/rules';
import { Textarea } from '@/components/ui/textarea';
import { PendingButton } from '@/shared/views/pending-button';
import {
  useWorkspaceWriteBlock,
  type ConnectionContext,
} from '@/shared/workspace/connection';
import {
  actionFailureMessage,
  useCommentOnPullRequest,
} from '../commands/pull-request-actions';

export function PullRequestComposer({
  context,
  projectId,
  number,
  reviewAction,
}: {
  context: ConnectionContext;
  projectId: string;
  number: number;
  reviewAction?: ReactNode;
}) {
  const inputId = useId();
  const errorId = useId();
  const [body, setBody] = useState('');
  const writeBlock = useWorkspaceWriteBlock(context);
  const { result, submit } = useCommentOnPullRequest(
    context.connection,
    projectId,
    number,
    () => setBody(''),
  );
  const empty = body.trim() === '';
  const send = () => {
    if (empty || writeBlock || result.waiting) return;
    void submit(body);
  };
  const failed = AsyncResult.isFailure(result);
  return (
    <form
      aria-label="Comment on GitHub"
      className="mt-5 min-w-0 @min-3xl/pr:ml-7.5"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Comment on pull request #{number}
      </label>
      <Textarea
        id={inputId}
        value={body}
        maxLength={PULL_REQUEST_COMMENT_CHARACTERS}
        placeholder="Comment on GitHub"
        disabled={result.waiting}
        aria-invalid={failed || undefined}
        aria-describedby={failed ? errorId : undefined}
        className="min-h-18"
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            send();
          }
        }}
      />
      <div className="mt-2 flex min-w-0 flex-wrap items-center justify-end gap-2">
        {failed && (
          <p
            id={errorId}
            role="alert"
            className="mr-auto min-w-0 text-ui text-destructive"
          >
            {actionFailureMessage(result.cause)}
          </p>
        )}
        {writeBlock && (
          <p className="mr-auto text-ui text-muted-foreground">{writeBlock}</p>
        )}
        {reviewAction}
        <PendingButton
          type="submit"
          size="sm"
          pending={result.waiting}
          disabled={empty || Boolean(writeBlock)}
          aria-description={writeBlock}
        >
          Comment
        </PendingButton>
      </div>
    </form>
  );
}
