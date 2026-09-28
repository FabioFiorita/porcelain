import { GitBranchIcon, PlusIcon, SparklesIcon } from 'lucide-react';
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
import { FileTypeIcon } from '@/features/files/index';
import { groupedCommitModels } from '../rules/commit-model';
import {
  changedSinceLooked,
  gitErrorMessage,
  receiptFailed,
} from '../rules/feedback';
import { GitActionError } from './git-action-message';
import { useCommitForm } from '../commands/commit-form';
import type { CommitFormProps } from '../rules/commit-form';
import { useDraftCancellation } from '../adapters/form-lifetime';
import { commitFiles } from '@/features/changes/index';

export function CommitForm(
  props: CommitFormProps & { context: Parameters<typeof useCommitForm>[1] },
) {
  const { status, onLookAgain, replacedSubject } = props;
  const form = useCommitForm(
    props,
    props.context,
    commitFiles(props.status.changes),
  );
  useDraftCancellation(form.controllers);
  const {
    mode,
    commitAction,
    git,
    generator,
    models,
    model,
    editingFiles,
    excluded,
    added,
    groups,
    done,
    activeGroup,
    files,
    commitPaths,
    paths,
    currentMessage,
    uncertain,
    receipt,
    working,
    error,
    staleDraft,
    leftUncommitted,
    blocker,
    commitModeBlocker,
    amendModeBlocker,
  } = form;
  return (
    <form
      className="flex min-w-0 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        form.commit();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          if (!blocker) form.commit();
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
        <Tabs value={mode} onValueChange={form.setMode}>
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
                  onClick={() => form.toggleEditingFiles()}
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
                      onChange={(event) =>
                        form.setIncluded(file.path, event.target.checked)
                      }
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
                onChange={(event) => form.setCurrentMessage(event.target.value)}
                rows={4}
                maxLength={form.messageLimit}
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
                  onClick={() => form.generate()}
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
                  onChange={(event) => form.setModel(event.target.value)}
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
                    onClick={() => form.removeGroup(group.id)}
                  >
                    Remove empty group
                  </Button>
                )}
                <Textarea
                  aria-label={`Message for commit ${index + 1}`}
                  value={group.message}
                  disabled={done.has(group.id)}
                  required
                  maxLength={form.messageLimit}
                  onChange={(event) =>
                    form.setGroupMessage(group.id, event.target.value)
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
                          form.moveFile(file.paths, event.target.value)
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
                        form.moveFile(file.paths, event.target.value)
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
                  disabled={groups.length >= form.groupLimit}
                  onClick={form.addGroup}
                >
                  <PlusIcon />
                  Add group
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={form.clearGroups}
                >
                  Single commit
                </Button>
              </div>
            )}
          </>
        )}
      </fieldset>
      {staleDraft && (
        <p role="alert" className="text-sm text-graph-4">
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
      {receipt && !(error && receiptFailed(receipt)) && (
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
      {error ? <GitActionError text={gitErrorMessage(error)} /> : null}
      {receipt && changedSinceLooked(receipt) && onLookAgain && (
        <Button
          type="button"
          variant="outline"
          disabled={working}
          onClick={form.lookAgain}
        >
          Look again
        </Button>
      )}
      {git.operation && !working && (
        <Button type="button" variant="outline" onClick={form.checkOutcome}>
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
