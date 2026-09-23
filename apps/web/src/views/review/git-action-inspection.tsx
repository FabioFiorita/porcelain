import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useGitStatus } from '../../query/review';
import { usePreferences } from '../workspace/preferences';
import { CommitForm } from './commit-form';
import {
  changedSinceLooked,
  expectationFor,
  gitErrorMessage,
  receiptFailed,
} from './git-action-feedback';
import { GitActionError } from './git-action-message';
import { type GitActionStatus, gitActions } from './git-action-options';

export function GitActionInspection({
  scope,
  entry,
  status,
  onBusy,
  onLookAgain,
}: {
  scope: ReviewScope;
  entry: GitAction;
  status: GitActionStatus;
  onBusy: (busy: boolean) => void;
  onLookAgain?: (() => Promise<void>) | undefined;
}) {
  if (
    entry === 'switch-branch' ||
    entry === 'create-branch' ||
    entry === 'discard'
  )
    return null;
  if (entry === 'commit' || entry === 'amend')
    return (
      <CommitActionForm
        scope={scope}
        action={entry}
        status={status}
        onBusy={onBusy}
        onLookAgain={onLookAgain}
      />
    );
  return (
    <RemoteActionForm
      key={entry}
      scope={scope}
      action={entry}
      status={status}
      onBusy={onBusy}
      onLookAgain={onLookAgain}
    />
  );
}

function CommitActionForm({
  scope,
  action,
  status,
  onBusy,
  onLookAgain,
}: {
  scope: ReviewScope;
  action: 'commit' | 'amend';
  status: GitActionStatus;
  onBusy: (busy: boolean) => void;
  onLookAgain?: (() => Promise<void>) | undefined;
}) {
  const details = useGitStatus(scope);
  if (details.pending)
    return (
      <>
        <CommitInspectionHeader action={action} />
        <p role="status">Reading commit details…</p>
      </>
    );
  if (action === 'amend' && !details.status?.headCommit)
    return (
      <>
        <CommitInspectionHeader action={action} />
        <p role="alert">
          The last commit could not be read. Close and try again.
        </p>
      </>
    );
  const head = details.status?.headCommit;
  return (
    <CommitForm
      scope={scope}
      action={action}
      status={{
        ...status,
        branch: details.status?.branch ?? status.branch,
      }}
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

function RemoteActionForm({
  scope,
  action,
  status,
  onBusy,
  onLookAgain,
}: {
  scope: ReviewScope;
  action: Exclude<
    GitAction,
    'commit' | 'amend' | 'switch-branch' | 'create-branch' | 'discard'
  >;
  status: GitActionStatus;
  onBusy: (busy: boolean) => void;
  onLookAgain?: (() => Promise<void>) | undefined;
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
      status={{
        ...status,
        branch: details.status?.branch ?? status.branch,
      }}
      expectedStatus={status}
      onBusy={onBusy}
      onLookAgain={onLookAgain}
    />
  );
}

function ActionForm({
  scope,
  action,
  status,
  expectedStatus = status,
  onBusy,
  onLookAgain,
}: {
  scope: ReviewScope;
  action: Exclude<
    GitAction,
    'commit' | 'amend' | 'switch-branch' | 'create-branch' | 'discard'
  >;
  status: GitActionStatus;
  expectedStatus?: GitActionStatus;
  onBusy: (busy: boolean) => void;
  onLookAgain?: (() => Promise<void>) | undefined;
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
  const [option, setOption] = useState(action === 'stash-create');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const outcome = git.operation?.receipt;
  const uncertain = Boolean(git.operation && !git.canStartNew);
  const remote = action === 'push' || action === 'pull' || action === 'fetch';
  const stash = action.startsWith('stash-');
  function input(): ActionInput {
    switch (action) {
      case 'push':
        return { action, remoteName, destinationRef: ref, allowCreate: option };
      case 'pull':
        return { action, remoteName, sourceRef: ref, strategy };
      case 'fetch':
        return { action, remoteName, sourceRef: ref };
      case 'stash-create':
        return { action, message, includeUntracked: option };
      default:
        return { action, stashOid, restoreIndex: option };
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
          .run(
            input(),
            expectationFor(
              expectedStatus,
              stash
                ? (expectedStatus.files?.map((file) => file.path) ?? [])
                : [],
              remote ? (branch?.upstreamOid ?? null) : undefined,
              stash,
            ),
          )
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
            : strategy === 'rebase'
              ? 'Pull rebases local commits onto upstream, rewriting their commit IDs.'
              : 'Pull only moves forward when there are no diverging local commits.'}
        </p>
      )}
      {outcome?.message &&
      receiptFailed(outcome) &&
      outcome.state !== 'conflicted' ? (
        <GitActionError text={outcome.message} />
      ) : outcome ? (
        <p role="status" className="text-sm">
          {outcome.state}
          {outcome.message
            ? ` · ${outcome.message}`
            : outcome.reason
              ? ` · ${outcome.reason.replaceAll('_', ' ').toLowerCase()}`
              : ''}
        </p>
      ) : null}
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
      {error ? <GitActionError text={gitErrorMessage(error)} /> : null}
      {outcome && changedSinceLooked(outcome) && onLookAgain && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            void onLookAgain()
              .then(() => git.startNew())
              .catch(setError)
              .finally(() => setBusy(false));
          }}
        >
          Look again
        </Button>
      )}
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
          busy || uncertain || Boolean(outcome && changedSinceLooked(outcome))
        }
      >
        {busy
          ? 'Working…'
          : gitActions.find((entry) => entry.id === action)?.label}
      </Button>
    </form>
  );
}
