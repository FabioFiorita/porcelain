import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { commitFiles } from '../../domain/commit-files';
import type { ActionInput, GitAction } from '../../domain/git-action';
import type { ReviewScope, Status } from '../../domain/review';
import { useGitAction } from '../../query/git-actions';
import { reviewErrorMessage } from '../../query/review';
import { gitActions } from './git-action-options';

export function GitActionInspection({
  scope,
  entry,
  status,
}: {
  scope: ReviewScope;
  entry: string;
  status?: Status;
}) {
  return (
    <ActionForm
      key={entry}
      scope={scope}
      action={entry as GitAction}
      status={status}
    />
  );
}

function ActionForm({
  scope,
  action,
  status,
}: {
  scope: ReviewScope;
  action: GitAction;
  status: Status | undefined;
}) {
  const git = useGitAction(scope, action);
  const branch = status?.branch;
  const [message, setMessage] = useState(
    action === 'stash-create' ? 'Porcelain review' : '',
  );
  const [remoteName, setRemote] = useState(branch?.remoteName ?? 'origin');
  const [ref, setRef] = useState(
    branch?.sourceRef ??
      `refs/heads/${branch?.name?.replace(/^refs\/heads\//, '') ?? 'main'}`,
  );
  const [stashOid, setStash] = useState(branch?.stashes?.[0]?.oid ?? '');
  const [option, setOption] = useState(false);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const files = commitFiles(status?.changes ?? []);
  const paths = [
    ...new Set(
      files
        .filter((file) => !excluded.has(file.path))
        .flatMap((file) => file.paths),
    ),
  ];
  const outcome = git.operation?.receipt;
  const uncertain = Boolean(git.operation && !git.canStartNew);
  const remote = action === 'push' || action === 'pull' || action === 'fetch';
  function input(): ActionInput {
    switch (action) {
      case 'commit':
        return { message, paths };
      case 'push':
        return { remoteName, destinationRef: ref, allowCreate: option };
      case 'pull':
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
        setError(null);
        void git
          .run(input())
          .catch(setError)
          .finally(() => setBusy(false));
      }}
    >
      <fieldset
        disabled={busy || uncertain}
        className="flex min-w-0 flex-col gap-4"
      >
        {action === 'commit' && (
          <>
            <p className="text-xs text-muted-foreground">
              {branch?.name ?? 'Current branch'} · {paths.length} selected files
            </p>
            <div className="max-h-44 overflow-auto rounded-lg border p-2">
              {files.map(({ path }) => {
                return (
                  <label
                    key={path}
                    className="flex min-w-0 items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={!excluded.has(path)}
                      onChange={(event) =>
                        setExcluded((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.delete(path);
                          else next.add(path);
                          return next;
                        })
                      }
                    />{' '}
                    <span className="truncate">{path}</span>
                  </label>
                );
              })}
            </div>
          </>
        )}
        {(action === 'commit' || action === 'stash-create') && (
          <Field>
            <FieldLabel htmlFor="git-message">Message</FieldLabel>
            <Textarea
              id="git-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
              maxLength={16384}
              rows={4}
              placeholder="Describe what changed and why"
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
              <select
                id="git-stash"
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={stashOid}
                onChange={(event) => setStash(event.target.value)}
              >
                {branch.stashes.map((stash) => (
                  <option key={stash.oid} value={stash.oid}>
                    {stash.message} · {stash.oid.slice(0, 7)}
                  </option>
                ))}
              </select>
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
        {!['commit', 'fetch', 'pull'].includes(action) && (
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
      {action === 'commit' && (
        <p className="text-xs text-muted-foreground">
          Selected files use their current contents. Other staged files stay
          staged. Pause other writers while committing.
        </p>
      )}
      {action === 'pull' && (
        <p className="text-xs text-muted-foreground">
          Pull fast-forwards this branch. Diverged branches need to be
          reconciled first.
        </p>
      )}
      {uncertain && !outcome && <p role="status">Outcome not yet confirmed</p>}
      {outcome && (
        <p role="status" className="text-sm">
          {outcome.state.replaceAll('-', ' ')}
          {outcome.reason
            ? ` · ${outcome.reason.replaceAll('_', ' ').toLowerCase()}`
            : ''}
        </p>
      )}
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
      <Button
        type="submit"
        disabled={
          busy ||
          uncertain ||
          (action === 'commit' &&
            (!paths.length ||
              status?.changes.some((change) => change.scope === 'unmerged')))
        }
      >
        {busy
          ? 'Working…'
          : action === 'commit'
            ? 'Commit selected files'
            : gitActions.find((entry) => entry.id === action)?.label}
      </Button>
    </form>
  );
}
