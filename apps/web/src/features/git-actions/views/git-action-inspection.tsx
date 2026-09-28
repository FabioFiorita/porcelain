import { useState } from 'react';
import { useAccessStore } from '@/features/access/index';
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
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { HISTORY_OID_LENGTH } from '@/config/limits';
import { useActionForm } from '../commands/action-form';
import { actionFormInput, type FormAction } from '../rules/action-form';
import type { GitAction, GitScope } from '../rules/git-action';
import { gitActionLabel } from '../rules/git-action-options';
import {
  changedSinceLooked,
  gitErrorMessage,
  receiptFailed,
} from '../rules/feedback';
import type { GitActionStatus } from '../rules/status';
import { CommitForm } from './commit-form';
import { GitActionError } from './git-action-message';

type GitContext = Parameters<typeof useActionForm>[2];

export function GitActionInspection({
  scope,
  context,
  entry,
  status,
  onBusy,
  onLookAgain,
}: {
  scope: GitScope;
  context: GitContext;
  entry: GitAction;
  status: GitActionStatus;
  onBusy: (busy: boolean) => void;
  onLookAgain?: (() => Promise<void>) | undefined;
}) {
  if (
    entry === 'switch-branch' ||
    entry === 'create-branch' ||
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
}: {
  scope: GitScope;
  context: GitContext;
  action: 'commit' | 'amend';
  status: GitActionStatus;
  onBusy: (busy: boolean) => void;
  onLookAgain?: (() => Promise<void>) | undefined;
}) {
  const connection = useAccessStore((state) => state.connection);
  const details = useGitStatus(scope, connection);
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
      context={context}
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

function StashActionForm({
  scope,
  context,
  action,
  status,
  onBusy,
  onLookAgain,
}: {
  scope: GitScope;
  context: GitContext;
  action: FormAction;
  status: GitActionStatus;
  onBusy: (busy: boolean) => void;
  onLookAgain?: (() => Promise<void>) | undefined;
}) {
  const connection = useAccessStore((state) => state.connection);
  const details = useGitStatus(scope, connection);
  if (details.pending)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Reading branch…
      </p>
    );
  return (
    <ActionForm
      scope={scope}
      context={context}
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
  context,
  action,
  status,
  expectedStatus = status,
  onBusy,
  onLookAgain,
}: {
  scope: GitScope;
  context: GitContext;
  action: FormAction;
  status: GitActionStatus;
  expectedStatus?: GitActionStatus;
  onBusy: (busy: boolean) => void;
  onLookAgain?: (() => Promise<void>) | undefined;
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
        git.submit(actionFormInput(action, { message, stashOid, option }));
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
              <NativeSelect
                id="git-stash"
                value={stashOid}
                onChange={(event) => setStash(event.target.value)}
              >
                {branch.stashes.map((stash) => (
                  <NativeSelectOption key={stash.oid} value={stash.oid}>
                    {stash.message} · {stash.oid.slice(0, HISTORY_OID_LENGTH)}
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
