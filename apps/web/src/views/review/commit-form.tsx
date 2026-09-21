import { PlusIcon, SparklesIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { commitFiles } from '../../domain/commit-files';
import { resolveCommitModel } from '../../domain/commit-model';
import type { CommitDraft } from '../../domain/git-action';
import type { ReviewScope } from '../../domain/review';
import { createId } from '../../lib/id';
import {
  useCommitDraft,
  useCommitModels,
  useGitAction,
} from '../../query/git-actions';
import { usePreferences } from '../workspace/preferences';
import {
  changedSinceLooked,
  expectationFor,
  gitErrorMessage,
  receiptFailed,
  receiptWords,
} from './git-action-feedback';
import type { GitActionStatus } from './git-action-options';

type Group = CommitDraft['groups'][number] & { id: string };
const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';
export function CommitForm({
  scope,
  status,
  action = 'commit',
  onBusy,
  onLookAgain,
  initialMessage = '',
  replacedSubject,
}: {
  scope: ReviewScope;
  status: GitActionStatus;
  action?: 'commit' | 'amend';
  initialMessage?: string;
  replacedSubject?: string;
  onBusy: (busy: boolean) => void;
  onLookAgain?: (() => Promise<void>) | undefined;
}) {
  const git = useGitAction(scope, action);
  const generator = useCommitDraft(scope);
  const models = useCommitModels();
  const { preferences } = usePreferences();
  const model = resolveCommitModel(models.data, preferences.commitModel);
  const [message, setMessage] = useState(initialMessage);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [ownHead, setOwnHead] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [draftToken, setDraftToken] = useState<string | null>(null);
  const drafts = useRef(new Set<AbortController>());
  useEffect(() => {
    const active = drafts.current;
    return () => {
      for (const controller of active) controller.abort();
      active.clear();
    };
  }, []);
  const files = commitFiles(status.changes);
  const paths = [
    ...new Set(
      files
        .filter((file) => !excluded.has(file.path))
        .flatMap((file) => file.paths),
    ),
  ];
  const uncertain = Boolean(git.operation && !git.canStartNew);
  const receipt = git.operation?.receipt;
  const working = busy || generator.isPending;
  async function draft(input: Parameters<typeof generator.submit>[0]) {
    const controller = new AbortController();
    drafts.current.add(controller);
    try {
      return await generator.submit({ ...input, signal: controller.signal });
    } finally {
      drafts.current.delete(controller);
    }
  }
  async function generate(mode: 'message' | 'groups') {
    if (!model || !paths.length || working) return;
    setBusy(true);
    setError(null);
    try {
      const result = await draft({
        mode,
        model,
        paths,
        expectedStatusToken: status.statusToken,
      });
      setDraftToken(status.statusToken);
      setDone(new Set());
      setActiveGroup(null);
      if (mode === 'message') {
        setMessage(result.groups[0]?.message ?? '');
        setGroups(null);
      } else
        setGroups(result.groups.map((group) => ({ ...group, id: createId() })));
    } catch (error) {
      if (!isAbort(error)) setError(error);
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (working || uncertain) return;
    setBusy(true);
    setError(null);
    let writing = false;
    try {
      let text = message;
      if (groups === null && !text.trim()) {
        if (!model || !paths.length)
          throw new Error('Give every commit a message and at least one file.');
        const result = await draft({
          mode: 'message',
          model,
          paths,
          expectedStatusToken: status.statusToken,
        });
        text = result.groups[0]?.message ?? '';
        setMessage(text);
        setDraftToken(status.statusToken);
      }
      const pending =
        action === 'amend'
          ? [{ id: 'single', message: text, paths }]
          : groups
            ? groups.filter((group) => !done.has(group.id))
            : [{ id: 'single', message: text, paths }];
      let expectedHead = ownHead ?? status.headOid ?? null;
      writing = true;
      onBusy(true);
      for (const group of pending) {
        if (
          !group.message.trim() ||
          (action !== 'amend' &&
            status.inProgress !== 'merge' &&
            !group.paths.length)
        )
          throw new Error('Give every commit a message and at least one file.');
        setActiveGroup(group.id);
        const result = await git.run(
          {
            action,
            message: group.message,
            paths: group.paths,
          },
          expectationFor(
            { ...status, headOid: expectedHead },
            status.inProgress === 'merge'
              ? (status.files?.map((file) => file.path) ?? [])
              : group.paths,
            undefined,
            true,
          ),
        );
        if (receiptFailed(result)) throw new Error(receiptWords(result));
        if (result.result?.headOid) {
          expectedHead = result.result.headOid;
          setOwnHead(expectedHead);
        }
        setDone((current) => new Set([...current, group.id]));
        setActiveGroup(null);
      }
    } catch (error) {
      if (!isAbort(error)) setError(error);
    } finally {
      if (writing) onBusy(false);
      setBusy(false);
    }
  }
  const staleDraft =
    draftToken != null && done.size === 0 && draftToken !== status.statusToken;
  const leftUncommitted = groups
    ? files.filter(
        (file) => !groups.some((group) => group.paths.includes(file.path)),
      )
    : [];
  const blocker = staleDraft
    ? true
    : groups
      ? groups
          .filter((group) => !done.has(group.id))
          .some((group) => !group.message.trim() || !group.paths.length)
      : (action !== 'amend' &&
          status.inProgress !== 'merge' &&
          !paths.length) ||
        (!message.trim() && (!model || !paths.length));
  return (
    <form
      className="flex min-w-0 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void commit();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          if (!blocker) void commit();
        }
      }}
    >
      <p className="text-xs text-muted-foreground">
        {status.branch?.name?.replace(/^refs\/heads\//, '') ?? 'Detached HEAD'}{' '}
        · {paths.length} selected files
      </p>
      <fieldset
        disabled={working || uncertain}
        className="flex min-w-0 flex-col gap-3"
      >
        {groups === null || action === 'amend' ? (
          <>
            <div className="max-h-40 overflow-auto rounded-lg border p-2">
              {files.map(({ path }) => (
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
                  />
                  <span className="truncate">{path}</span>
                </label>
              ))}
            </div>
            <Field>
              <FieldLabel htmlFor="commit-message">Message</FieldLabel>
              <Textarea
                id="commit-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={4}
                maxLength={16384}
                placeholder="Describe what changed and why"
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              {action === 'commit' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!model || !paths.length}
                  onClick={() => void generate('message')}
                >
                  <SparklesIcon />
                  Generate with AI
                </Button>
              )}
              {action === 'commit' && status.inProgress !== 'merge' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!model || !paths.length}
                  onClick={() => void generate('groups')}
                >
                  Use groups
                </Button>
              )}
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {models.data?.find((entry) => entry.id === model)?.label ??
                  (models.data?.length
                    ? 'Choose a commit model in Settings'
                    : 'No coding CLI available')}
              </span>
            </div>
          </>
        ) : (
          <>
            {groups.map((group, index) => (
              <section
                key={group.id}
                className="flex flex-col gap-2 rounded-lg border p-3"
                aria-label={`Commit ${index + 1}`}
              >
                <p className="text-xs text-muted-foreground">
                  Commit {index + 1}
                  {done.has(group.id)
                    ? ' · committed'
                    : activeGroup === group.id
                      ? ' · in progress'
                      : ''}
                </p>
                {group.paths.length === 0 && done.size === 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setGroups(
                        (current) =>
                          current?.filter((entry) => entry.id !== group.id) ??
                          null,
                      )
                    }
                  >
                    Remove empty group
                  </Button>
                )}
                <Textarea
                  aria-label={`Message for commit ${index + 1}`}
                  value={group.message}
                  disabled={done.has(group.id)}
                  required
                  maxLength={16384}
                  onChange={(event) =>
                    setGroups(
                      (current) =>
                        current?.map((entry) =>
                          entry.id === group.id
                            ? { ...entry, message: event.target.value }
                            : entry,
                        ) ?? null,
                    )
                  }
                />
                {files
                  .filter((file) => group.paths.includes(file.path))
                  .map((file) => (
                    <div
                      key={file.path}
                      className="flex min-w-0 items-center gap-2 text-xs"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {file.path}
                      </span>
                      <NativeSelect
                        aria-label={`Commit for ${file.path}`}
                        value={group.id}
                        disabled={done.size > 0}
                        size="sm"
                        onChange={(event) =>
                          setGroups(
                            (current) =>
                              current?.map((entry) => ({
                                ...entry,
                                paths: [
                                  ...entry.paths.filter(
                                    (path) => !file.paths.includes(path),
                                  ),
                                  ...(entry.id === event.target.value
                                    ? file.paths
                                    : []),
                                ],
                              })) ?? null,
                          )
                        }
                      >
                        <NativeSelectOption value="uncommitted">
                          Leave uncommitted
                        </NativeSelectOption>
                        {groups.map((entry, position) => (
                          <NativeSelectOption key={entry.id} value={entry.id}>
                            Commit {position + 1}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>
                  ))}
              </section>
            ))}
            {leftUncommitted.length > 0 && (
              <section className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
                <p className="text-xs text-muted-foreground">
                  Left uncommitted
                </p>
                {leftUncommitted.map((file) => (
                  <div
                    key={file.path}
                    className="flex min-w-0 items-center gap-2 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate">{file.path}</span>
                    <NativeSelect
                      aria-label={`Commit for ${file.path}`}
                      value="uncommitted"
                      disabled={done.size > 0}
                      size="sm"
                      onChange={(event) =>
                        setGroups(
                          (current) =>
                            current?.map((entry) => ({
                              ...entry,
                              paths: [
                                ...entry.paths.filter(
                                  (path) => !file.paths.includes(path),
                                ),
                                ...(entry.id === event.target.value
                                  ? file.paths
                                  : []),
                              ],
                            })) ?? null,
                        )
                      }
                    >
                      <NativeSelectOption value="uncommitted">
                        Leave uncommitted
                      </NativeSelectOption>
                      {groups.map((entry, position) => (
                        <NativeSelectOption key={entry.id} value={entry.id}>
                          Commit {position + 1}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                ))}
              </section>
            )}
            {done.size === 0 && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={groups.length >= 20}
                  onClick={() =>
                    setGroups((current) => [
                      ...(current ?? []),
                      { id: createId(), message: '', paths: [] },
                    ])
                  }
                >
                  <PlusIcon />
                  Add group
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setGroups(null);
                    setDraftToken(null);
                  }}
                >
                  Single commit
                </Button>
              </div>
            )}
          </>
        )}
      </fieldset>
      {staleDraft && (
        <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">
          The worktree changed since this draft was proposed. Generate it again
          before committing.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {action === 'amend'
          ? `Amending replaces the last commit${replacedSubject ? `: ${replacedSubject}` : ''}. ${status.branch?.upstream && status.branch.ahead === 0 ? 'This commit is already on the known upstream; amending rewrites shared history.' : 'Unselected staged changes stay staged.'}`
          : status.inProgress === 'merge'
            ? 'This finishes the merge and commits every staged resolution, including staged files outside your selection.'
            : 'Selected files use their current contents. Other staged files stay staged.'}
      </p>
      {receipt && (
        <div role="status" className="text-sm">
          <p>{receipt.state}</p>
          {receipt.progress.map((line) => (
            <p key={line} className="text-xs text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
      )}
      {uncertain && !receipt && <p role="status">Outcome not yet confirmed</p>}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {gitErrorMessage(error)}
        </p>
      ) : null}
      {receipt && changedSinceLooked(receipt) && onLookAgain && (
        <Button
          type="button"
          variant="outline"
          disabled={working}
          onClick={() => {
            setBusy(true);
            setError(null);
            void onLookAgain()
              .then(() => {
                git.startNew();
                setOwnHead(null);
                setDraftToken(null);
              })
              .catch(setError)
              .finally(() => setBusy(false));
          }}
        >
          Look again
        </Button>
      )}
      {git.operation && !working && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setError(null);
            void git.recover
              .submit()
              .then((receipt) => {
                if (
                  activeGroup &&
                  ['succeeded', 'no-change'].includes(receipt.state)
                ) {
                  setDone((current) => new Set([...current, activeGroup]));
                  setActiveGroup(null);
                }
              })
              .catch(setError);
          }}
        >
          Check outcome
        </Button>
      )}
      <Button
        type="submit"
        disabled={
          working ||
          uncertain ||
          Boolean(receipt && changedSinceLooked(receipt)) ||
          blocker ||
          (status.inProgress !== 'merge' &&
            status.changes.some((change) => change.scope === 'unmerged')) ||
          Boolean(groups?.every((group) => done.has(group.id)))
        }
      >
        {working
          ? generator.isPending
            ? 'Generating…'
            : action === 'amend'
              ? 'Amending…'
              : 'Committing…'
          : groups && action === 'commit'
            ? 'Commit groups in order'
            : action === 'amend'
              ? 'Amend last commit'
              : 'Commit selected files'}
      </Button>
    </form>
  );
}
