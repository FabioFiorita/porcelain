import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type {
  ActionInput,
  GitAction,
  Preparation,
} from '../../domain/git-action';
import type { ReviewScope } from '../../domain/review';
import { discardRejection, submitForm } from '../../lib/submit-form';
import { useGitAction } from '../../query/git-actions';
import { reviewErrorMessage } from '../../query/review';
import {
  branchStatus,
  type GitActionStatus,
  gitActions,
} from './git-action-options';
import { ReviewEmpty } from './review-empty';

export function GitActionInspection({
  scope,
  entry,
  status,
}: {
  scope: ReviewScope;
  entry: string;
  status?: GitActionStatus;
}) {
  const action = gitActions.find((item) => item.id === entry);
  if (!action)
    return (
      <ReviewEmpty
        title="Choose a Git action"
        description="Prepare an action from the review sidebar."
      />
    );
  return (
    <GitActionForm
      key={entry}
      scope={scope}
      action={action.id}
      {...(status ? { status } : {})}
    />
  );
}
function GitActionForm({
  scope,
  action,
  status,
}: {
  scope: ReviewScope;
  action: GitAction;
  status?: GitActionStatus;
}) {
  const git = useGitAction(scope, action);
  const [draft, setDraft] = useState({
    message: '',
    remoteName: 'origin',
    ref: 'refs/heads/main',
    stashOid: '',
    option: false,
  });
  const [confirmed, setConfirmed] = useState(false);
  const input = actionInput(action, draft);
  const busy =
    git.prepare.isPending || git.execute.isPending || git.recover.isPending;
  const locked = Boolean(git.preparation || git.operation);
  const error = git.prepare.error || git.execute.error || git.recover.error;
  return (
    <article className="mx-auto flex max-w-xl flex-col gap-5 px-2 py-2">
      <header className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">
          {action === 'commit'
            ? 'Commit changes'
            : 'Prepare · Review · Confirm'}
        </p>
        <h3 className="mt-2 text-xl font-medium">
          {gitActions.find((item) => item.id === action)?.label}
        </h3>
        <p className="text-sm text-muted-foreground">
          {action === 'commit'
            ? 'Only files already in the existing index are committed.'
            : 'Review the captured scope before confirming this operation.'}
        </p>
      </header>

      {status && <GitActionStatusSummary action={action} status={status} />}

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => submitForm(event, () => git.prepare.submit(input))}
      >
        <FieldGroup className="rounded-xl border bg-card/50 p-4">
          <fieldset
            disabled={locked || busy}
            className="flex min-w-0 flex-col gap-5"
          >
            <ActionFields action={action} draft={draft} onChange={setDraft} />
          </fieldset>
          {!locked && (
            <Button type="submit" disabled={busy}>
              {git.prepare.isPending ? 'Preparing…' : 'Prepare action'}
            </Button>
          )}
        </FieldGroup>
      </form>
      {git.preparation && !git.operation && (
        <ConfirmAction
          git={git}
          action={action}
          busy={busy}
          confirmed={confirmed}
          onConfirm={setConfirmed}
        />
      )}
      {git.operation && (
        <OperationReceipt
          git={git}
          busy={busy}
          onReset={() => setConfirmed(false)}
        />
      )}
      {error && (
        <Alert>
          <AlertDescription>{reviewErrorMessage(error)}</AlertDescription>
        </Alert>
      )}
    </article>
  );
}

function GitActionStatusSummary({
  action,
  status,
}: {
  action: GitAction;
  status: GitActionStatus;
}) {
  if (action !== 'commit') return null;
  const branch = branchStatus(status);
  const staged = status.changes.filter(
    (change) => change.scope === 'staged',
  ).length;
  const working = status.changes.filter(
    (change) => change.scope === 'unstaged',
  ).length;
  const untracked = status.changes.filter(
    (change) => change.scope === 'untracked',
  ).length;
  const conflicts = status.changes.filter(
    (change) => change.scope === 'unmerged',
  ).length;

  return (
    <section
      aria-label="Current Git status"
      className="flex flex-col gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-[12.5px]"
    >
      {branch && (
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground">Branch</span>
          <span className="truncate font-medium">
            {branch.name?.replace(/^refs\/heads\//, '') ?? 'Detached HEAD'}
          </span>
          <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
            {branch.ahead} ahead · {branch.behind} behind
          </span>
        </div>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Staged files</dt>
        <dd className="tabular-nums">{staged}</dd>
        <dt className="text-muted-foreground">Working changes</dt>
        <dd className="tabular-nums">{working}</dd>
        <dt className="text-muted-foreground">Untracked files</dt>
        <dd className="tabular-nums">{untracked}</dd>
        {conflicts > 0 && (
          <>
            <dt className="text-muted-foreground">Conflicts</dt>
            <dd className="tabular-nums">{conflicts}</dd>
          </>
        )}
      </dl>
      <p className="text-xs text-muted-foreground">
        Committing uses the existing index; unstaged and untracked files stay in
        the worktree.
      </p>
    </section>
  );
}

type Draft = {
  message: string;
  remoteName: string;
  ref: string;
  stashOid: string;
  option: boolean;
};
function actionInput(action: GitAction, draft: Draft): ActionInput {
  switch (action) {
    case 'fetch':
      return { remoteName: draft.remoteName, sourceRef: draft.ref };
    case 'push':
      return {
        remoteName: draft.remoteName,
        destinationRef: draft.ref,
        allowCreate: draft.option,
      };
    case 'commit':
      return { message: draft.message };
    case 'stash-create':
      return { message: draft.message, includeUntracked: draft.option };
    default:
      return { stashOid: draft.stashOid, restoreIndex: draft.option };
  }
}
function ActionFields({
  action,
  draft,
  onChange,
}: {
  action: GitAction;
  draft: Draft;
  onChange: (draft: Draft) => void;
}) {
  return (
    <>
      {action === 'fetch' || action === 'push' ? (
        <>
          <Field>
            <FieldLabel htmlFor="remote-name">Configured remote</FieldLabel>
            <Input
              id="remote-name"
              value={draft.remoteName}
              onChange={(e) =>
                onChange({ ...draft, remoteName: e.target.value })
              }
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="remote-ref">Full branch ref</FieldLabel>
            <Input
              id="remote-ref"
              value={draft.ref}
              onChange={(e) => onChange({ ...draft, ref: e.target.value })}
              required
              pattern="refs/heads/.+"
            />
          </Field>
        </>
      ) : action === 'commit' || action === 'stash-create' ? (
        <Field>
          <FieldLabel htmlFor="git-message">Message</FieldLabel>
          <Textarea
            id="git-message"
            value={draft.message}
            onChange={(e) => onChange({ ...draft, message: e.target.value })}
            required
            maxLength={16384}
          />
          <p className="text-xs text-muted-foreground">
            {action === 'commit'
              ? 'Only the existing index is committed. Files are not automatically staged.'
              : 'Tracked staged and unstaged changes are included. Ignored files remain excluded.'}
          </p>
        </Field>
      ) : (
        <Field>
          <FieldLabel htmlFor="stash-oid">Full stash object ID</FieldLabel>
          <Input
            id="stash-oid"
            value={draft.stashOid}
            onChange={(e) => onChange({ ...draft, stashOid: e.target.value })}
            required
            pattern="([a-f0-9]{40}|[a-f0-9]{64})"
          />
        </Field>
      )}
      {action !== 'fetch' && action !== 'commit' && (
        <Field orientation="horizontal">
          <input
            id="git-option"
            aria-label={
              action === 'push'
                ? 'Allow creating the remote branch'
                : action === 'stash-create'
                  ? 'Include untracked files'
                  : 'Restore index'
            }
            type="checkbox"
            checked={draft.option}
            onChange={(e) => onChange({ ...draft, option: e.target.checked })}
          />
          <FieldLabel htmlFor="git-option">
            {action === 'push'
              ? 'Allow creating the remote branch'
              : action === 'stash-create'
                ? 'Include untracked files'
                : 'Restore index'}
          </FieldLabel>
        </Field>
      )}
    </>
  );
}

function PreparationDetails({ preparation }: { preparation: Preparation }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-muted/50 px-3 py-2.5">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Branch</dt>
        <dd className="break-all">
          {preparation.preview.branch ?? 'Detached HEAD'}
        </dd>
        <dt className="text-muted-foreground">Staged changes</dt>
        <dd>{preparation.preview.staged ? 'Yes' : 'No'}</dd>
        <dt className="text-muted-foreground">Tracked changes</dt>
        <dd>{preparation.preview.trackedChanges ? 'Yes' : 'No'}</dd>
        <dt className="text-muted-foreground">Untracked files</dt>
        <dd>{preparation.preview.untrackedCount}</dd>
        {preparation.preview.destination && (
          <>
            <dt className="text-muted-foreground">Destination</dt>
            <dd className="break-all">{preparation.preview.destination}</dd>
          </>
        )}
      </dl>
      <p className="text-xs text-muted-foreground">
        Preparation expires at{' '}
        {new Date(preparation.expiresAt).toLocaleTimeString()}. Remote state is
        checked during execution.
      </p>
    </div>
  );
}

function OperationReceipt({
  git,
  busy,
  onReset,
}: {
  git: ReturnType<typeof useGitAction>;
  busy: boolean;
  onReset: () => void;
}) {
  if (!git.operation) return null;
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border p-4"
      aria-label="Git operation receipt"
    >
      <h4 className="font-medium">
        {git.operation.receipt?.state ?? 'Outcome not yet confirmed'}
      </h4>
      <p className="break-all font-mono text-xs">
        Request {git.operation.requestId}
      </p>
      {git.operation.receipt?.reason && <p>{git.operation.receipt.reason}</p>}
      <p className="text-sm text-muted-foreground">
        {git.canStartNew
          ? 'Review refreshed Git state before continuing.'
          : 'Check this receipt to recover the outcome. Do not repeat an uncertain action with a new request ID.'}
      </p>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => discardRejection(git.recover.submit())}
      >
        Check receipt
      </Button>
      {git.canStartNew && (
        <Button
          variant="outline"
          onClick={() => {
            git.startNew();
            onReset();
          }}
        >
          Prepare another action
        </Button>
      )}
    </section>
  );
}

function ConfirmAction({
  git,
  action,
  busy,
  confirmed,
  onConfirm,
}: {
  git: ReturnType<typeof useGitAction>;
  action: GitAction;
  busy: boolean;
  confirmed: boolean;
  onConfirm: (value: boolean) => void;
}) {
  if (!git.preparation) return null;
  return (
    <section className="flex flex-col gap-4 rounded-xl border p-4">
      <h4 className="font-medium">Review prepared action</h4>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => {
          git.cancelPreparation();
          onConfirm(false);
        }}
      >
        Edit preparation
      </Button>
      <PreparationDetails preparation={git.preparation} />
      <Field orientation="horizontal">
        <input
          type="checkbox"
          id="paused-writers"
          aria-label="I have reviewed the scope and paused external writers."
          checked={confirmed}
          onChange={(event) => onConfirm(event.target.checked)}
        />
        <FieldLabel htmlFor="paused-writers">
          I have reviewed the scope and paused external writers.
        </FieldLabel>
      </Field>
      <Button
        disabled={!confirmed || busy || Date.now() > git.preparation.expiresAt}
        onClick={() => {
          if (git.preparation)
            discardRejection(git.execute.submit(git.preparation.preparationId));
        }}
      >
        Confirm {action.replaceAll('-', ' ')}
      </Button>
    </section>
  );
}
