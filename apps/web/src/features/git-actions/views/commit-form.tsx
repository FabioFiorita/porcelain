import { TruncatedText } from '@/shared/views/truncated-text';
import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
import { PlusIcon, SparklesIcon } from 'lucide-react';
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
import { BranchTracking } from '@/features/history/index';
import { branchTracking } from '@porcelain/client/history/rules';
import { GitActionError } from './git-action-message';
import { useCommitForm } from '../commands/commit-form';
import type { CommitFormProps } from '@porcelain/client/git-actions/rules';
import { useDraftCancellation } from '../adapters/form-lifetime';
import { commitFiles } from '@porcelain/client/changes/rules';
import { usePreferences } from '@/features/preferences/index';

export function CommitForm(
  props: CommitFormProps & { context: Parameters<typeof useCommitForm>[1] },
) {
  const { status, liveBranch, onLookAgain } = props;
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
    model,
    groups,
    done,
    commitPaths,
    uncertain,
    receipt,
    working,
    error,
    staleDraft,
    blocker,
    commitModeBlocker,
    amendModeBlocker,
  } = form;
  return (
    <form
      className="flex min-w-0 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!blocker && !working && !uncertain) form.commit();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          if (!blocker && !working && !uncertain) form.commit();
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
        <BranchTracking
          tracking={branchTracking(liveBranch ?? undefined, null)}
        />
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
        {mode === 'groups' ? (
          <CommitGroups form={form} />
        ) : (
          <CommitFiles form={form} />
        )}
      </fieldset>
      {commitAction === 'commit' && <CommitGeneration form={form} />}
      {mode !== 'groups' && !form.currentMessage.trim() && (
        <p className="text-xs text-muted-foreground" role="status">
          Write or generate a message before committing.
        </p>
      )}
      {staleDraft && (
        <p role="alert" className="text-sm text-graph-4">
          The worktree changed since this draft was proposed. Generate it again
          before committing.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {commitNote(props, commitAction)}
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
        {submitLabel(form)}
      </Button>
    </form>
  );
}

type CommitFormState = ReturnType<typeof useCommitForm>;

function CommitFiles({ form }: { form: CommitFormState }) {
  const {
    commitAction,
    editingFiles,
    excluded,
    added,
    files,
    paths,
    currentMessage,
    working,
  } = form;
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
              <FileTypeIcon path={file.path} className="size-3.5 shrink-0" />
              <TruncatedText className="min-w-0 flex-1" text={file.path} />
              <span className="shrink-0 text-muted-foreground">
                {fileState(file.kind, included, commitAction)}
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
        {commitAction === 'commit' && form.draftedBy.message && (
          <p className="text-xs text-muted-foreground">
            {form.draftedBy.message}
          </p>
        )}
        <Textarea
          id="commit-message"
          value={currentMessage}
          onChange={(event) => form.setCurrentMessage(event.target.value)}
          rows={4}
          maxLength={form.messageLimit}
          placeholder="Describe what changed and why"
        />
      </Field>
    </>
  );
}

function CommitGeneration({ form }: { form: CommitFormState }) {
  const { models, model } = form;
  const choices = Option.getOrUndefined(AsyncResult.value(models));
  const chosen = choices?.find((entry) => entry.id === model);
  const reason = generationReason(form);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={Boolean(reason) || form.working || form.uncertain}
        onClick={() => form.generate()}
      >
        <SparklesIcon />
        {form.generator.result.waiting ? 'Generating…' : 'Generate with AI'}
      </Button>
      <Select
        items={
          choices?.map((entry) => ({
            value: entry.id,
            label: entry.label,
          })) ?? []
        }
        value={model ?? null}
        disabled={!choices?.length || form.working || form.uncertain}
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
              choices?.length ? 'Choose a model' : 'No coding CLI available'
            }
          />
        </SelectTrigger>
        <SelectContent>
          {groupedCommitModels(
            choices?.filter((entry) => !entry.id.endsWith(':default')) ?? [],
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
      <p className="w-full text-xs text-muted-foreground" role="status">
        {reason ??
          `Sends the selected changes to ${chosen?.label} through ${model?.split(':')[0] === 'claude' ? 'Claude Code' : 'Codex'}.`}
      </p>
      {AsyncResult.isFailure(form.generator.result) && !form.working && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={Boolean(reason) || form.uncertain}
          onClick={form.generate}
        >
          Try again
        </Button>
      )}
    </div>
  );
}

function generationReason({ models, model, paths }: CommitFormState) {
  if (AsyncResult.isFailure(models))
    return 'Could not load coding CLI models. You can still commit manually.';
  const choices = Option.getOrUndefined(AsyncResult.value(models));
  if (!choices) return 'Loading coding CLI models…';
  if (!model && choices.some((entry) => !entry.id.endsWith(':default')))
    return 'Choose a model to generate a message.';
  if (!model)
    return 'No coding CLI available. Write a message to commit manually.';
  if (!paths.length) return 'Select files to generate a message.';
  return null;
}

function groupProposalStatus(error: unknown, working: boolean) {
  if (error) return 'Groups were not proposed.';
  if (working) return 'Proposing commits…';
  return 'Generate groups with AI, then review each message and file before committing.';
}

function CommitGroups({ form }: { form: CommitFormState }) {
  const { groups, done, activeGroup, files, leftUncommitted, error } = form;
  if (groups === null) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {groupProposalStatus(error, form.working)}
      </p>
    );
  }
  const assignments = [
    { value: 'uncommitted', label: 'Leave uncommitted' },
    ...groups.map((entry, position) => ({
      value: entry.id,
      label: `Commit ${position + 1}`,
    })),
  ];
  return (
    <>
      {form.draftedBy.groups && (
        <p className="text-xs text-muted-foreground">{form.draftedBy.groups}</p>
      )}
      {groups.map((group, index) => (
        <section
          key={group.id}
          className="flex flex-col gap-2 rounded-lg border p-3"
          aria-label={`Commit ${index + 1}`}
        >
          <p className="text-xs text-muted-foreground">
            Commit {index + 1}
            {groupProgress(group.id, done, activeGroup)}
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
                <TruncatedText className="min-w-0 flex-1" text={file.path} />
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
          <p className="text-xs text-muted-foreground">Left uncommitted</p>
          {leftUncommitted.map((file) => (
            <div
              key={file.path}
              className="flex min-w-0 items-center gap-2 text-xs"
            >
              <TruncatedText className="min-w-0 flex-1" text={file.path} />
              <Select
                items={assignments}
                value="uncommitted"
                disabled={done.size > 0}
                onValueChange={(value) => {
                  if (value) form.moveFile(file.paths, value);
                }}
              >
                <SelectTrigger size="sm" aria-label={`Commit for ${file.path}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncommitted">Leave uncommitted</SelectItem>
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
}

function fileState(
  kind: string,
  included: boolean,
  commitAction: CommitFormState['commitAction'],
) {
  if (included) return kind.replaceAll('-', ' ');
  if (commitAction === 'amend') return 'Not added';
  return 'Excluded';
}

function groupProgress(
  id: string,
  done: CommitFormState['done'],
  activeGroup: CommitFormState['activeGroup'],
) {
  if (done.has(id)) return ' · committed';
  if (activeGroup === id) return ' · in progress';
  return '';
}

function commitNote(
  { status, liveBranch, replacedSubject }: CommitFormProps,
  commitAction: CommitFormState['commitAction'],
) {
  if (commitAction === 'amend') {
    return `Amending replaces the last commit${replacedSubject ? `: ${replacedSubject}` : ''}. ${liveBranch?.upstream && liveBranch.ahead === 0 ? 'This commit is already on the known upstream; amending rewrites shared history.' : 'Unselected staged changes stay staged.'}`;
  }
  if (status.inProgress === 'merge') {
    return 'This finishes the merge and commits every staged resolution, including staged files outside your selection.';
  }
  return 'Selected files use their current contents. Other staged files stay staged.';
}

function submitLabel({
  working,
  generator,
  groups,
  commitAction,
}: CommitFormState) {
  if (working) {
    if (generator.result.waiting) return 'Generating…';
    if (commitAction === 'amend') return 'Amending…';
    return 'Committing…';
  }
  if (groups && commitAction === 'commit') return 'Commit groups in order';
  if (commitAction === 'amend') return 'Amend last commit';
  return 'Commit selected files';
}
