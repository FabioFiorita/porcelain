import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import type { ActionInput, GitAction } from '../../domain/git-action';
import type { ReviewScope } from '../../domain/review';
import { useGitAction } from '../../query/git-actions';
import { reviewErrorMessage, useGitStatus } from '../../query/review';
import { usePreferences } from '../workspace/preferences';
import { CommitForm } from './commit-form';
import { type GitActionStatus, gitActions } from './git-action-options';

export function GitActionInspection({
  scope,
  entry,
  status,
  onBusy,
}: {
  scope: ReviewScope;
  entry: GitAction;
  status: GitActionStatus;
  onBusy: (busy: boolean) => void;
}) {
  return entry === 'commit' ? (
    <CommitForm scope={scope} status={status} onBusy={onBusy} />
  ) : (
    <RemoteActionForm
      key={entry}
      scope={scope}
      action={entry}
      status={status}
      onBusy={onBusy}
    />
  );
}

/**
 * The remote name, source ref and stashes cost two Git processes that say
 * nothing about what changed, so they are read here, when the panel that fills
 * its fields from them opens. The form waits for them rather than starting on
 * defaults it would then have to replace under the person's cursor.
 */
function RemoteActionForm({
  scope,
  action,
  status,
  onBusy,
}: {
  scope: ReviewScope;
  action: Exclude<GitAction, 'commit'>;
  status: GitActionStatus;
  onBusy: (busy: boolean) => void;
}) {
  const details = useGitStatus(scope);
  if (details.pending)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Reading branch…
      </p>
    );
  return (
    <ActionForm
      scope={scope}
      action={action}
      status={details.status ?? status}
      onBusy={onBusy}
    />
  );
}

function ActionForm({
  scope,
  action,
  status,
  onBusy,
}: {
  scope: ReviewScope;
  action: Exclude<GitAction, 'commit'>;
  status: GitActionStatus;
  onBusy: (busy: boolean) => void;
}) {
  const git = useGitAction(scope, action);
  const { preferences } = usePreferences();
  const [strategy] = useState(preferences.pullStrategy);
  const branch = status.branch;
  const [message, setMessage] = useState('Porcelain review');
  const [remoteName, setRemote] = useState(branch?.remoteName ?? 'origin');
  const [ref, setRef] = useState(
    branch?.sourceRef ??
      `refs/heads/${branch?.name?.replace(/^refs\/heads\//, '') ?? 'main'}`,
  );
  const [stashOid, setStash] = useState(branch?.stashes?.[0]?.oid ?? '');
  const [option, setOption] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const outcome = git.operation?.receipt;
  const uncertain = Boolean(git.operation && !git.canStartNew);
  const remote = action === 'push' || action === 'pull' || action === 'fetch';
  function input(): ActionInput {
    switch (action) {
      case 'push':
        return { remoteName, destinationRef: ref, allowCreate: option };
      case 'pull':
        return { remoteName, sourceRef: ref, strategy };
      case 'fetch':
        return { remoteName, sourceRef: ref };
      case 'stash-create':
        return { message, includeUntracked: option };
      default:
        return { stashOid, restoreIndex: option };
    }
  }
  return (
    <form
      className="flex min-w-0 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || uncertain) return;
        setBusy(true);
        onBusy(true);
        setError(null);
        void git
          .run(input())
          .catch(setError)
          .finally(() => {
            setBusy(false);
            onBusy(false);
          });
      }}
    >
      <fieldset
        disabled={busy || uncertain}
        className="flex min-w-0 flex-col gap-4"
      >
        {action === 'stash-create' && (
          <p className="text-xs text-muted-foreground">
            Every change, new files included, is set aside. The handoff stays
            empty until you pop the stash.
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
              maxLength={16384}
            />
          </Field>
        )}
        {remote && (
          <>
            <Field>
              <FieldLabel htmlFor="git-remote">Remote</FieldLabel>
              <Input
                id="git-remote"
                value={remoteName}
                onChange={(event) => setRemote(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="git-ref">Branch ref</FieldLabel>
              <Input
                id="git-ref"
                value={ref}
                onChange={(event) => setRef(event.target.value)}
                pattern="refs/heads/.+"
                required
              />
            </Field>
          </>
        )}
        {(action === 'stash-apply' || action === 'stash-pop') && (
          <Field>
            <FieldLabel htmlFor="git-stash">Stash</FieldLabel>
            {branch?.stashes?.length ? (
              <NativeSelect
                id="git-stash"
                value={stashOid}
                onChange={(event) => setStash(event.target.value)}
              >
                {branch.stashes.map((stash) => (
                  <NativeSelectOption key={stash.oid} value={stash.oid}>
                    {stash.message} · {stash.oid.slice(0, 7)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
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
        {!['fetch', 'pull'].includes(action) && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={option}
              onChange={(event) => setOption(event.target.checked)}
            />
            {action === 'push'
              ? 'Create the remote branch if needed'
              : action === 'stash-create'
                ? 'Include untracked files'
                : 'Restore staged changes'}
          </label>
        )}
      </fieldset>
      {action === 'pull' && (
        <p className="text-xs text-muted-foreground">
          {strategy === 'merge'
            ? 'Pull merges upstream changes into this branch.'
            : 'Pull rebases local commits onto upstream, rewriting their commit IDs.'}
        </p>
      )}
      {outcome && (
        <p role="status" className="text-sm">
          {outcome.state}
          {outcome.reason
            ? ` · ${outcome.reason.replaceAll('_', ' ').toLowerCase()}`
            : ''}
        </p>
      )}
      {action === 'pull' && outcome?.state === 'conflicted' && (
        <p role="alert" className="text-sm">
          Pull stopped with conflicts. In this worktree, run{' '}
          <code>git status</code> and follow its instructions to resolve and
          continue. To undo the pull, run <code>git merge --abort</code> for a
          merge or <code>git rebase --abort</code> for a rebase. Finish or abort
          before starting another Git action.
        </p>
      )}
      {uncertain && !outcome && <p role="status">Outcome not yet confirmed</p>}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {reviewErrorMessage(error)}
        </p>
      ) : null}
      {git.operation && !busy && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setError(null);
            void git.recover.submit().catch(setError);
          }}
        >
          Check outcome
        </Button>
      )}
      <Button type="submit" disabled={busy || uncertain}>
        {busy
          ? 'Working…'
          : gitActions.find((entry) => entry.id === action)?.label}
      </Button>
    </form>
  );
}
