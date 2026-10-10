import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
import { GitBranchIcon, PlusIcon, SparklesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { FileTypeIcon } from '@/features/files/index';
import { groupedCommitModels } from '@porcelain/client/git-actions/rules';
import {
  changedSinceLooked,
  gitErrorMessage,
  receiptFailed,
} from '@porcelain/client/git-actions/rules';
import { GitActionError } from './git-action-message';
import { useCommitForm } from '../commands/commit-form';
import type { CommitFormProps } from '@porcelain/client/git-actions/rules';
import { useDraftCancellation } from '../adapters/form-lifetime';
import { commitFiles } from '@porcelain/client/changes/rules';
import { usePreferences } from '@/features/preferences/index';

export function CommitForm(
  props: CommitFormProps & { context: Parameters<typeof useCommitForm>[1] },
) {
  const { status, liveBranch, onLookAgain, replacedSubject } = props;
  const { preferences, setPreference } = usePreferences();
  const form = useCommitForm(
    props,
    props.context,
    commitFiles(props.status.changes),
    {
      value: preferences.commitModel,
      set: (value) => setPreference('commitModel', value),
    },
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
  const choices = Option.getOrUndefined(AsyncResult.value(models));
  const assignments = [
    { value: 'uncommitted', label: 'Leave uncommitted' },
    ...(groups?.map((entry, position) => ({
      value: entry.id,
      label: `Commit ${position + 1}`,
    })) ?? []),
  ];
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
      <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-caption">
        <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">
          {liveBranch?.name?.replace(/^refs\/heads\//, '') ?? 'Detached HEAD'}
        </span>
        {liveBranch?.upstream !== null &&
          liveBranch?.upstream !== undefined && (
            <span className="ml-auto shrink-0 text-muted-foreground">
              {liveBranch.ahead} ahead · {liveBranch.behind} behind
            </span>
          )}
      </div>
      {status.inProgress !== 'merge' && (
        <Tabs value={mode} onValueChange={form.setMode}>
          <TabsList className="w-full">
            <TabsTrigger
              value="single"
              className="flex-1"
              disabled={
                working ||
                (commitModeBlocker !== null && commitModeBlocker !== undefined)
              }
            >
              Single commit
            </TabsTrigger>
            <TabsTrigger
              value="amend"
              className="flex-1"
              disabled={
                working ||
                (amendModeBlocker !== null && amendModeBlocker !== undefined)
              }
            >
              Amend last
            </TabsTrigger>
            <TabsTrigger
              value="groups"
              className="flex-1"
              disabled={
                working ||
                (commitModeBlocker !== null &&
                  commitModeBlocker !== undefined) ||
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
        {(() => {
          if (mode !== 'groups') {
            return (
              <>
                <div className="flex items-center gap-1.5 text-caption">
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
                        <span className="min-w-0 flex-1 truncate">
                          {file.path}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {(() => {
                            if (included) {
                              return file.kind.replaceAll('-', ' ');
                            }
                            if (commitAction === 'amend') {
                              return 'Not added';
                            }
                            return 'Excluded';
                          })()}
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
                    onChange={(event) =>
                      form.setCurrentMessage(event.target.value)
                    }
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
                    <Select
                      items={
                        choices?.map((entry) => ({
                          value: entry.id,
                          label: entry.label,
                        })) ?? []
                      }
                      value={model ?? null}
                      disabled={!choices?.length}
                      onValueChange={(value) => {
                        if (value) form.setModel(value);
                      }}
                    >
                      <SelectTrigger
                        aria-label="Commit model"
                        className="w-auto max-w-48"
                        size="sm"
                      >
                        <SelectValue
                          placeholder={
                            choices?.length
                              ? 'Choose a model'
                              : 'No coding CLI available'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {groupedCommitModels(
                          choices?.filter(
                            (entry) => !entry.id.endsWith(':default'),
                          ) ?? [],
                        ).map(([provider, entries]) => (
                          <SelectGroup key={provider}>
                            <SelectLabel>{provider}</SelectLabel>
                            {entries.map((entry) => (
                              <SelectItem key={entry.id} value={entry.id}>
                                {entry.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            );
          }
          if (groups === null) {
            return (
              <p role="status" className="text-sm text-muted-foreground">
                {error ? 'Groups were not proposed.' : 'Proposing commits…'}
              </p>
            );
          }
          return (
            <>
              {groups.map((group, index) => (
                <section
                  key={group.id}
                  className="flex flex-col gap-2 rounded-lg border p-3"
                  aria-label={`Commit ${index + 1}`}
                >
                  <p className="text-xs text-muted-foreground">
                    Commit {index + 1}
                    {(() => {
                      if (done.has(group.id)) {
                        return ' · committed';
                      }
                      if (activeGroup === group.id) {
                        return ' · in progress';
                      }
                      return '';
                    })()}
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
                        <Select
                          items={assignments}
                          value={group.id}
                          disabled={done.size > 0}
                          onValueChange={(value) => {
                            if (value) form.moveFile(file.paths, value);
                          }}
                        >
                          <SelectTrigger
                            size="sm"
                            aria-label={`Commit for ${file.path}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="uncommitted">
                              Leave uncommitted
                            </SelectItem>
                            {groups.map((entry, position) => (
                              <SelectItem key={entry.id} value={entry.id}>
                                Commit {position + 1}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                      <span className="min-w-0 flex-1 truncate">
                        {file.path}
                      </span>
                      <Select
                        items={assignments}
                        value="uncommitted"
                        disabled={done.size > 0}
                        onValueChange={(value) => {
                          if (value) form.moveFile(file.paths, value);
                        }}
                      >
                        <SelectTrigger
                          size="sm"
                          aria-label={`Commit for ${file.path}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="uncommitted">
                            Leave uncommitted
                          </SelectItem>
                          {groups.map((entry, position) => (
                            <SelectItem key={entry.id} value={entry.id}>
                              Commit {position + 1}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
          );
        })()}
      </fieldset>
      {staleDraft && (
        <p role="alert" className="text-sm text-graph-4">
          The worktree changed since this draft was proposed. Generate it again
          before committing.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {(() => {
          if (commitAction === 'amend') {
            return `Amending replaces the last commit${replacedSubject ? `: ${replacedSubject}` : ''}. ${liveBranch?.upstream && liveBranch.ahead === 0 ? 'This commit is already on the known upstream; amending rewrites shared history.' : 'Unselected staged changes stay staged.'}`;
          }
          if (status.inProgress === 'merge') {
            return 'This finishes the merge and commits every staged resolution, including staged files outside your selection.';
          }
          return 'Selected files use their current contents. Other staged files stay staged.';
        })()}
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
      {(staleDraft || (receipt && changedSinceLooked(receipt))) &&
        onLookAgain && (
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
        {(() => {
          if (working) {
            if (generator.result.waiting) {
              return 'Generating…';
            }
            if (commitAction === 'amend') {
              return 'Amending…';
            }
            return 'Committing…';
          }
          if (groups && commitAction === 'commit') {
            return 'Commit groups in order';
          }
          if (commitAction === 'amend') {
            return 'Amend last commit';
          }
          return 'Commit selected files';
        })()}
      </Button>
    </form>
  );
}
