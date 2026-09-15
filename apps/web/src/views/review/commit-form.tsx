import { PlusIcon, SparklesIcon } from 'lucide-react';
import { useState } from 'react';
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
import type { ReviewScope, Status } from '../../domain/review';
import { createId } from '../../lib/id';
import {
  useCommitDraft,
  useCommitModels,
  useGitAction,
} from '../../query/git-actions';
import { reviewErrorMessage } from '../../query/review';
import { usePreferences } from '../workspace/preferences';

type Group = CommitDraft['groups'][number] & { id: string };
export function CommitForm({
  scope,
  status,
  onBusy,
}: {
  scope: ReviewScope;
  status: Status;
  onBusy: (busy: boolean) => void;
}) {
  const git = useGitAction(scope, 'commit');
  const generator = useCommitDraft(scope);
  const models = useCommitModels();
  const { preferences } = usePreferences();
  const model = resolveCommitModel(models.data, preferences.commitModel);
  const [message, setMessage] = useState('');
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [expectedFiles, setExpectedFiles] = useState<
    CommitDraft['expectedFiles']
  >([]);
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
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
  function setWorking(value: boolean) {
    setBusy(value);
    onBusy(value);
  }
  async function generate(mode: 'message' | 'groups') {
    if (!model || !paths.length || working) return;
    setWorking(true);
    setError(null);
    try {
      const result = await generator.submit({
        mode,
        model,
        paths,
        expectedStatusToken: status.statusToken,
      });
      setExpectedFiles(result.expectedFiles);
      setDone(new Set());
      setActiveGroup(null);
      if (mode === 'message') {
        setMessage(result.groups[0]?.message ?? '');
        setGroups(null);
      } else
        setGroups(result.groups.map((group) => ({ ...group, id: createId() })));
    } catch (error) {
      setError(error);
    } finally {
      setWorking(false);
    }
  }
  async function commit() {
    if (working || uncertain) return;
    setWorking(true);
    setError(null);
    try {
      const pending = groups
        ? groups.filter((group) => !done.has(group.id))
        : [{ id: 'single', message, paths }];
      for (const group of pending) {
        if (!group.message.trim() || !group.paths.length)
          throw new Error('Give every commit a message and at least one file.');
        setActiveGroup(group.id);
        const result = await git.run({
          message: group.message,
          paths: group.paths,
          expectedFiles: expectedFiles.filter((file) =>
            group.paths.includes(file.path),
          ),
        });
        if (result.state !== 'succeeded' && result.state !== 'no-change')
          throw new Error(
            `Commit ${result.state}: ${result.reason?.replaceAll('_', ' ').toLowerCase() ?? 'check the current state'}`,
          );
        setDone((current) => new Set([...current, group.id]));
        setActiveGroup(null);
      }
    } catch (error) {
      setError(error);
    } finally {
      setWorking(false);
    }
  }
  const blocker = groups
    ? groups
        .filter((group) => !done.has(group.id))
        .some((group) => !group.message.trim() || !group.paths.length)
    : !paths.length || !message.trim();
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
        {status.branch?.name ?? 'Current branch'} · {paths.length} selected
        files
      </p>
      <fieldset
        disabled={working || uncertain}
        className="flex min-w-0 flex-col gap-3"
      >
        {groups === null ? (
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
                required
                maxLength={16384}
                placeholder="Describe what changed and why"
              />
            </Field>
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!model || !paths.length}
                onClick={() => void generate('groups')}
              >
                Use groups
              </Button>
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
                    setExpectedFiles([]);
                  }}
                >
                  Single commit
                </Button>
              </div>
            )}
          </>
        )}
      </fieldset>
      <p className="text-xs text-muted-foreground">
        Selected files use their current contents. Other staged files stay
        staged. Pause other writers while committing.
      </p>
      {receipt && (
        <p role="status" className="text-sm">
          {receipt.state}
        </p>
      )}
      {receipt?.reviewLayersUpdated === false && (
        <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">
          Commit saved, but its review notes could not move to History. The
          original notes are still available in Changes.
        </p>
      )}
      {uncertain && !receipt && <p role="status">Outcome not yet confirmed</p>}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {reviewErrorMessage(error)}
        </p>
      ) : null}
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
          blocker ||
          status.changes.some((change) => change.scope === 'unmerged') ||
          Boolean(groups?.every((group) => done.has(group.id)))
        }
      >
        {working
          ? generator.isPending
            ? 'Generating…'
            : 'Committing…'
          : groups
            ? 'Commit groups in order'
            : 'Commit selected files'}
      </Button>
    </form>
  );
}
