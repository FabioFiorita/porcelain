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
import { gitActions } from './git-action-options';
import { ReviewEmpty } from './review-empty';

export function GitActionInspection({
  scope,
  entry,
}: {
  scope: ReviewScope;
  entry: string;
}) {
  const action = gitActions.find((item) => item.id === entry);
  if (!action)
    return (
      <ReviewEmpty
        title="Choose a Git action"
        description="Prepare an action from the review sidebar."
      />
    );
  return <GitActionForm key={entry} scope={scope} action={action.id} />;
}
function GitActionForm({
  scope,
  action,
}: {
  scope: ReviewScope;
  action: GitAction;
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
    <article className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-8">
      <header>
        <p className="text-xs text-muted-foreground">
          Prepare · Review · Confirm
        </p>
        <h3 className="mt-2 text-xl font-medium">
          {gitActions.find((item) => item.id === action)?.label}
        </h3>
      </header>

      <form
        onSubmit={(event) => submitForm(event, () => git.prepare.submit(input))}
      >
        <FieldGroup>
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
    <>
      {' '}
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt>Branch</dt>
        <dd className="break-all">
          {preparation.preview.branch ?? 'Detached HEAD'}
        </dd>
        <dt>Staged changes</dt>
        <dd>{preparation.preview.staged ? 'Yes' : 'No'}</dd>
        <dt>Tracked changes</dt>
        <dd>{preparation.preview.trackedChanges ? 'Yes' : 'No'}</dd>
        <dt>Untracked files</dt>
        <dd>{preparation.preview.untrackedCount}</dd>
        {preparation.preview.destination && (
          <>
            <dt>Destination</dt>
            <dd className="break-all">{preparation.preview.destination}</dd>
          </>
        )}
      </dl>
      <p className="text-xs text-muted-foreground">
        Preparation expires at{' '}
        {new Date(preparation.expiresAt).toLocaleTimeString()}. Remote state is
        checked during execution.
      </p>
    </>
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
    <section className="flex flex-col gap-3" aria-label="Git operation receipt">
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
    <section className="flex flex-col gap-4">
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
