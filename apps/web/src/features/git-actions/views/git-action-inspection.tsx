import { Cause } from 'effect';
import type { ReactNode } from 'react';
import { AsyncResult } from 'effect/reactivity';
import { useState } from 'react';
import { useGitStatus } from '@/features/changes/index';
import { Button } from '@/components/ui/button';
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
  SelectItem,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { HISTORY_OID_LENGTH } from '@/config/limits';
import { useActionForm } from '../commands/action-form';
import {
  actionFormInput,
  type FormAction,
} from '@porcelain/client/git-actions/rules';
import type { GitAction, GitScope } from '@porcelain/client/git-actions/rules';
import { gitActionLabel } from '@porcelain/client/git-actions/rules';
import {
  changedSinceLooked,
  gitErrorMessage,
  receiptFailed,
} from '@porcelain/client/git-actions/rules';
import type { GitActionStatus } from '@porcelain/client/git-actions/rules';
import { CommitForm } from './commit-form';
import { GitActionError } from './git-action-message';
import { type ConnectionContext } from '@/shared/workspace/connection';

type InspectionFormProps<Action> = {
  scope: GitScope;
  context: ConnectionContext;
  action: Action;
  status: GitActionStatus;
  onBusy: (busy: boolean) => void;
  onLookAgain?: (() => Promise<void>) | undefined;
};

export function GitActionInspection({
  scope,
  context,
  entry,
  status,
  onBusy,
  onLookAgain,
}: {
  scope: GitScope;
  context: ConnectionContext;
  entry: GitAction;
  status: GitActionStatus;
  onBusy: (busy: boolean) => void;
  onLookAgain?: (() => Promise<void>) | undefined;
}) {
  if (
    entry === 'discard' ||
    entry === 'fetch' ||
    entry === 'pull' ||
    entry === 'push'
  )
    return null;
  if (entry === 'commit' || entry === 'amend')
    return (
      <CommitActionForm
        scope={scope}
        context={context}
        action={entry}
        status={status}
        onBusy={onBusy}
        onLookAgain={onLookAgain}
      />
    );
  return (
    <StashActionForm
      key={entry}
      scope={scope}
      context={context}
      action={entry}
      status={status}
      onBusy={onBusy}
      onLookAgain={onLookAgain}
    />
  );
}

function CommitActionForm({
  scope,
  context,
  action,
  status,
  onBusy,
  onLookAgain,
}: InspectionFormProps<'commit' | 'amend'>) {
  return (
    <GitStatusInspection
      scope={scope}
      context={context}
      pending={
        <>
          <CommitInspectionHeader action={action} />
          <p role="status">Reading commit details…</p>
        </>
      }
    >
      {(details) => {
        const head = details.headCommit;
        if (action === 'amend' && !head)
          return (
            <>
              <CommitInspectionHeader action={action} />
              <p role="alert">
                The last commit could not be read. Close and try again.
              </p>
            </>
          );
        return (
          <CommitForm
            scope={scope}
            context={context}
            action={action}
            status={status}
            liveBranch={details.branch ?? status.branch}
            initialMessage={
              action === 'amend' && head
                ? [head.subject, head.body].filter(Boolean).join('\n\n')
                : ''
            }
            lastCommitMessage={
              head ? [head.subject, head.body].filter(Boolean).join('\n\n') : ''
            }
            {...(head ? { replacedSubject: head.subject } : {})}
            onBusy={onBusy}
            onLookAgain={onLookAgain}
          />
        );
      }}
    </GitStatusInspection>
  );
}

function CommitInspectionHeader({ action }: { action: 'commit' | 'amend' }) {
  return (
    <DialogHeader>
      <DialogTitle>
        {action === 'amend' ? 'Amend last commit' : 'Commit changes'}
      </DialogTitle>
      <DialogDescription>
        {action === 'amend'
          ? 'The last commit is replaced by one with this message and the files you add.'
          : 'Committed steps fold away in the review and show up in History.'}
      </DialogDescription>
    </DialogHeader>
  );
}

function StashActionForm({
  scope,
  context,
  action,
  status,
  onBusy,
  onLookAgain,
}: InspectionFormProps<FormAction>) {
  return (
    <GitStatusInspection
      scope={scope}
      context={context}
      pending={
        <p role="status" className="text-sm text-muted-foreground">
          Reading branch…
        </p>
      }
    >
      {(details) => (
        <ActionForm
          scope={scope}
          context={context}
          action={action}
          status={{ ...status, branch: details.branch ?? status.branch }}
          expectedStatus={status}
          onBusy={onBusy}
          onLookAgain={onLookAgain}
        />
      )}
    </GitStatusInspection>
  );
}

function GitStatusInspection({
  scope,
  context,
  pending,
  children,
}: {
  scope: GitScope;
  context: ConnectionContext;
  pending: ReactNode;
  children: (
    status: AsyncResult.AsyncResult.Success<
      ReturnType<typeof useGitStatus>['result']
    >,
  ) => ReactNode;
}) {
  const details = useGitStatus(scope, context.connection);
  if (AsyncResult.isFailure(details.result))
    return (
      <>
        <GitActionError
          text={gitErrorMessage(Cause.squash(details.result.cause))}
        />
        <Button variant="outline" onClick={details.refresh}>
          Read status again
        </Button>
      </>
    );
  if (!AsyncResult.isSuccess(details.result)) return pending;
  return children(details.result.value);
}

function ActionForm({
  scope,
  context,
  action,
  status,
  expectedStatus = status,
  onBusy,
  onLookAgain,
}: InspectionFormProps<FormAction> & {
  expectedStatus?: GitActionStatus;
}) {
  const branch = status.branch;
  const [message, setMessage] = useState('Porcelain review');
  const [stashOid, setStash] = useState(branch?.stashes?.[0]?.oid ?? '');
  const [option, setOption] = useState(action === 'stash-create');
  const git = useActionForm(scope, action, context, {
    expectedStatus,
    onBusy,
    onLookAgain,
  });
  const { busy, uncertain, outcome, error } = git;
  return (
    <form
      className="flex min-w-0 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        git.onSubmit(actionFormInput(action, { message, stashOid, option }));
      }}
    >
      <fieldset
        disabled={busy || uncertain}
        className="flex min-w-0 flex-col gap-4"
      >
        {action === 'stash-create' && (
          <p className="text-xs text-muted-foreground">
            {option
              ? 'Tracked changes and new files are set aside. The handoff stays empty until you restore the stash.'
              : 'Tracked changes are set aside. New files stay in the worktree.'}
          </p>
        )}
        {action === 'stash-create' && (
          <Field>
            <FieldLabel htmlFor="git-message">Message</FieldLabel>
            <Textarea
              id="git-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
              maxLength={git.messageLimit}
            />
          </Field>
        )}
        {(action === 'stash-apply' || action === 'stash-pop') && (
          <Field>
            <FieldLabel htmlFor="git-stash">Stash</FieldLabel>
            {branch?.stashes?.length ? (
              <Select
                items={branch.stashes.map((stash) => ({
                  value: stash.oid,
                  label: `${stash.message} · ${stash.oid.slice(0, HISTORY_OID_LENGTH)}`,
                }))}
                value={stashOid}
                onValueChange={(value) => {
                  if (value) setStash(value);
                }}
              >
                <SelectTrigger id="git-stash">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branch.stashes.map((stash) => (
                    <SelectItem key={stash.oid} value={stash.oid}>
                      {stash.message} · {stash.oid.slice(0, HISTORY_OID_LENGTH)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="git-stash"
                value={stashOid}
                onChange={(event) => setStash(event.target.value)}
                required
                pattern="([a-f0-9]{40}|[a-f0-9]{64})"
              />
            )}
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={option}
            onChange={(event) => setOption(event.target.checked)}
          />
          {action === 'stash-create'
            ? 'Include untracked files'
            : 'Restore staged changes'}
        </label>
      </fieldset>
      {(() => {
        if (
          outcome?.message &&
          receiptFailed(outcome) &&
          outcome.state !== 'conflicted'
        ) {
          return <GitActionError text={outcome.message} />;
        }
        if (outcome) {
          return (
            <p role="status" className="text-sm">
              {outcome.state}
              {(() => {
                if (outcome.message) {
                  return ` · ${outcome.message}`;
                }
                if (outcome.reason) {
                  return ` · ${outcome.reason.replaceAll('_', ' ').toLowerCase()}`;
                }
                return '';
              })()}
            </p>
          );
        }
        return null;
      })()}
      {uncertain && !outcome && <p role="status">Outcome not yet confirmed</p>}
      {error ? <GitActionError text={gitErrorMessage(error)} /> : null}
      {outcome && changedSinceLooked(outcome) && onLookAgain && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={git.lookAgain}
        >
          Look again
        </Button>
      )}
      {git.operation && !busy && (
        <Button type="button" variant="outline" onClick={git.checkOutcome}>
          Check outcome
        </Button>
      )}
      <Button
        type="submit"
        disabled={
          busy || uncertain || Boolean(outcome && changedSinceLooked(outcome))
        }
      >
        {busy ? 'Working…' : gitActionLabel(action)}
      </Button>
    </form>
  );
}
