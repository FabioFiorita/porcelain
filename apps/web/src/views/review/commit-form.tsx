import { GitBranchIcon, PlusIcon, SparklesIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { commitFiles } from '../../domain/commit-files';
import {
  groupedCommitModels,
  resolveCommitModel,
} from '../../domain/commit-model';
import type { CommitDraft } from '../../domain/git-action';
import type { ReviewScope } from '../../domain/review';
import { createId } from '../../lib/id';
import {
  useCommitDraft,
  useCommitModels,
  useGitAction,
} from '../../query/git-actions';
import { usePreferences } from '../workspace/preferences';
import { FileTypeIcon } from './file-type-icon';
import {
  changedSinceLooked,
  expectationFor,
  gitErrorMessage,
  receiptFailed,
  receiptWords,
} from './git-action-feedback';
import { type GitActionStatus, gitActionBlocker } from './git-action-options';

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
  lastCommitMessage = '',
  replacedSubject,
}: {
  scope: ReviewScope;
  status: GitActionStatus;
  action?: 'commit' | 'amend';
  initialMessage?: string;
  lastCommitMessage?: string;
  replacedSubject?: string;
  onBusy: (busy: boolean) => void;
  onLookAgain?: (() => Promise<void>) | undefined;
}) {
  const [mode, setMode] = useState<'single' | 'amend' | 'groups'>(
    action === 'amend' ? 'amend' : 'single',
  );
  const commitAction = mode === 'amend' ? 'amend' : 'commit';
  const git = useGitAction(scope, commitAction);
  const generator = useCommitDraft(scope);
  const models = useCommitModels();
  const { preferences, setPreference } = usePreferences();
  const model = resolveCommitModel(models.data, preferences.commitModel);
  const [message, setMessage] = useState(
    action === 'commit' ? initialMessage : '',
  );
  const [amendMessage, setAmendMessage] = useState(
    action === 'amend' ? initialMessage : lastCommitMessage,
  );
  const [editingFiles, setEditingFiles] = useState(false);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
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
  const commitPaths = [
    ...new Set(
      files
        .filter((file) => !excluded.has(file.path))
        .flatMap((file) => file.paths),
    ),
  ];
  const amendPaths = [
    ...new Set(
      files
        .filter((file) => added.has(file.path))
        .flatMap((file) => file.paths),
    ),
  ];
  const paths = commitAction === 'amend' ? amendPaths : commitPaths;
  const currentMessage = commitAction === 'amend' ? amendMessage : message;
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
  async function generate(mode: 'message' | 'groups', selectedPaths = paths) {
    if (!model || !selectedPaths.length || working) return;
    setBusy(true);
    setError(null);
    try {
      const result = await draft({
        mode,
        model,
        paths: selectedPaths,
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
      let text = currentMessage;
      if (mode !== 'groups' && !text.trim()) {
        if (commitAction === 'amend')
          throw new Error('Give the amended commit a message.');
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
        commitAction === 'amend'
          ? [{ id: 'single', message: text, paths }]
          : mode === 'groups' && groups
            ? groups.filter((group) => !done.has(group.id))
            : [{ id: 'single', message: text, paths }];
      let expectedHead = ownHead ?? status.headOid ?? null;
      writing = true;
      onBusy(true);
      for (const group of pending) {
        if (
          !group.message.trim() ||
          (commitAction !== 'amend' &&
            status.inProgress !== 'merge' &&
            !group.paths.length)
        )
          throw new Error('Give every commit a message and at least one file.');
        setActiveGroup(group.id);
        const result = await git.run(
          {
            action: commitAction,
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
    commitAction === 'commit' &&
    draftToken != null &&
    done.size === 0 &&
    draftToken !== status.statusToken;
  const leftUncommitted = groups
    ? files.filter(
        (file) => !groups.some((group) => group.paths.includes(file.path)),
      )
    : [];
  const blocker = staleDraft
    ? true
    : mode === 'groups' && groups
      ? groups
          .filter((group) => !done.has(group.id))
          .some((group) => !group.message.trim() || !group.paths.length)
      : commitAction === 'amend'
        ? !currentMessage.trim()
        : (status.inProgress !== 'merge' && !paths.length) ||
          (!currentMessage.trim() && (!model || !paths.length));
  const commitModeBlocker = gitActionBlocker('commit', status);
  const amendModeBlocker = gitActionBlocker('amend', status);
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
      <DialogHeader>
        <DialogTitle>
          {commitAction === 'amend' ? 'Amend last commit' : 'Commit changes'}
        </DialogTitle>
        <DialogDescription>
          {commitAction === 'amend'
            ? 'The last commit is replaced by one with this message and the files you add.'
            : 'Committed steps fold away in the review and show up in History.'}
        </DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-[12.5px]">
        <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">
          {status.branch?.name?.replace(/^refs\/heads\//, '') ??
            'Detached HEAD'}
        </span>
        {status.branch?.upstream != null && (
          <span className="ml-auto shrink-0 text-muted-foreground">
            {status.branch.ahead} ahead · {status.branch.behind} behind
          </span>
        )}
      </div>
      {status.inProgress !== 'merge' && (
        <Tabs
          value={mode}
          onValueChange={(value) => {
            const next = value as typeof mode;
            setMode(next);
            if (next === 'single') {
              setGroups(null);
              setDraftToken(null);
            }
            if (next === 'groups' && groups === null && !working)
              void generate('groups', commitPaths);
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger
              value="single"
              className="flex-1"
              disabled={working || commitModeBlocker != null}
            >
              Single commit
            </TabsTrigger>
            <TabsTrigger
              value="amend"
              className="flex-1"
              disabled={working || amendModeBlocker != null}
            >
              Amend last
            </TabsTrigger>
            <TabsTrigger
              value="groups"
              className="flex-1"
              disabled={
                working ||
                commitModeBlocker != null ||
                !model ||
                !commitPaths.length
              }
            >
              Use groups
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      <fieldset
        disabled={working || uncertain}
        className="flex min-w-0 flex-col gap-3"
      >
        {mode !== 'groups' ? (
          <>
            <div className="flex items-center gap-1.5 text-[12.5px]">
              <span className="font-medium">
                {commitAction === 'amend' ? 'Files to add' : 'Files'}
              </span>
              <span className="text-muted-foreground tabular-nums">
                ({paths.length} of {files.length})
              </span>
              {commitAction === 'commit' && files.length > 0 && (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="ml-auto"
                  disabled={working}
                  onClick={() => setEditingFiles((current) => !current)}
                >
                  {editingFiles ? 'Done' : 'Edit'}
                </Button>
              )}
            </div>
            <div className="max-h-40 overflow-auto rounded-xl border p-1">
              {files.map((file) => {
                const included =
                  commitAction === 'amend'
                    ? added.has(file.path)
                    : !excluded.has(file.path);
                const choosing = commitAction === 'amend' || editingFiles;
                const body = (
                  <>
                    <FileTypeIcon
                      path={file.path}
                      className="size-3.5 shrink-0"
                    />
                    <span className="min-w-0 flex-1 truncate">{file.path}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {included
                        ? file.kind.replaceAll('-', ' ')
                        : commitAction === 'amend'
                          ? 'Not added'
                          : 'Excluded'}
                    </span>
                  </>
                );
                return choosing ? (
                  <label
                    key={file.path}
                    className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      aria-label={file.path}
                      checked={included}
                      onChange={(event) => {
                        if (commitAction === 'amend')
                          setAdded((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(file.path);
                            else next.delete(file.path);
                            return next;
                          });
                        else
                          setExcluded((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.delete(file.path);
                            else next.add(file.path);
                            return next;
                          });
                      }}
                    />
                    {body}
                  </label>
                ) : (
                  <div
                    key={file.path}
                    className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-xs"
                  >
                    {body}
                  </div>
                );
              })}
            </div>
            <Field>
              <FieldLabel htmlFor="commit-message">Message</FieldLabel>
              <Textarea
                id="commit-message"
                value={currentMessage}
                onChange={(event) => {
                  if (commitAction === 'amend')
                    setAmendMessage(event.target.value);
                  else setMessage(event.target.value);
                }}
                rows={4}
                maxLength={16384}
                placeholder="Describe what changed and why"
              />
            </Field>
            {commitAction === 'commit' && (
              <div className="flex flex-wrap items-center gap-2">
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
                <NativeSelect
                  aria-label="Commit model"
                  className="w-auto max-w-48"
                  size="sm"
                  value={model ?? ''}
                  disabled={!models.data?.length}
                  onChange={(event) =>
                    setPreference('commitModel', event.target.value)
                  }
                >
                  {!model && (
                    <NativeSelectOption value="" disabled>
                      {models.data?.length
                        ? 'Choose a model'
                        : 'No coding CLI available'}
                    </NativeSelectOption>
                  )}
                  {groupedCommitModels(
                    models.data?.filter(
                      (entry) => !entry.id.endsWith(':default'),
                    ) ?? [],
                  ).map(([provider, entries]) => (
                    <NativeSelectOptGroup key={provider} label={provider}>
                      {entries.map((entry) => (
                        <NativeSelectOption key={entry.id} value={entry.id}>
                          {entry.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  ))}
                </NativeSelect>
              </div>
            )}
          </>
        ) : groups === null ? (
          <p role="status" className="text-sm text-muted-foreground">
            {error ? 'Groups were not proposed.' : 'Proposing commits…'}
          </p>
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
        {commitAction === 'amend'
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
          Boolean(
            mode === 'groups' && groups?.every((group) => done.has(group.id)),
          )
        }
      >
        {working
          ? generator.isPending
            ? 'Generating…'
            : commitAction === 'amend'
              ? 'Amending…'
              : 'Committing…'
          : groups && commitAction === 'commit'
            ? 'Commit groups in order'
            : commitAction === 'amend'
              ? 'Amend last commit'
              : 'Commit selected files'}
      </Button>
    </form>
  );
}
