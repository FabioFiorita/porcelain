import { gitErrorMessage } from '@porcelain/client/git-actions/rules';
import { AsyncResult } from 'effect/reactivity';
import { Cause, Effect, Option } from 'effect';
import {
  commitForm,
  generateCommitForm,
  lookAgainCommitForm,
  recoverCommitForm,
} from '@porcelain/client/git-actions';
import {
  COMMIT_MESSAGE_BYTES,
  COMMIT_GROUPS,
} from '@porcelain/contracts/shared';
import { useForm, useSelector } from '@tanstack/react-form';
import { createId } from '@/shared/lib/id';
import { resolveCommitModel } from '@porcelain/client/git-actions/rules';
import {
  commitFormDefaults,
  type CommitFormProps,
  type CommitMode,
  type DraftedFiles,
  type Drafts,
  draftIsStale,
  type Group,
} from '@porcelain/client/git-actions/rules';
import { gitActionBlocker } from '@porcelain/client/git-actions/rules';
import { commitState, commitDraftControllers } from '../store';
import { useAtomRef } from '@effect/atom-react';
import { useCommitModels } from '../queries/git-actions';
import { useGitAction } from './run-action';
import { useCommitDraft } from './commit-draft';
import { type ConnectionContext } from '@/shared/workspace/connection';

type CommitModelChoice = { value: string; set: (value: string) => void };

function useCommitFormState(
  {
    scope,
    status,
    action = 'commit',
    onBusy,
    onLookAgain,
    initialMessage = '',
    lastCommitMessage = '',
  }: CommitFormProps,
  context: ConnectionContext,
  files: { path: string; paths: string[]; kind: string }[],
  commitModel: CommitModelChoice,
) {
  const form = useForm({
    defaultValues: commitFormDefaults(
      action,
      initialMessage,
      lastCommitMessage,
    ),
  });
  const state = commitState(form);
  const controllers = commitDraftControllers(form);
  const { mode, message, amendMessage, excluded, added, groups } = useSelector(
    form.store,
    (state) => state.values,
  );
  const { done, activeGroup, ownHead, busy, error, drafted, editingFiles } =
    useAtomRef(state);
  const setMode = (value: CommitMode) => form.setFieldValue('mode', value);
  const setMessage = (value: string) => form.setFieldValue('message', value);
  const setAmendMessage = (value: string) =>
    form.setFieldValue('amendMessage', value);
  const setExcluded = (value: ReadonlySet<string>) =>
    form.setFieldValue('excluded', value);
  const setAdded = (value: ReadonlySet<string>) =>
    form.setFieldValue('added', value);
  const setGroups = (value: Group[] | null) =>
    form.setFieldValue('groups', value);
  const setDone = (
    value:
      | ReadonlySet<string>
      | ((current: ReadonlySet<string>) => ReadonlySet<string>),
  ) =>
    state.update((current) => ({
      ...current,
      done: typeof value === 'function' ? value(current.done) : value,
    }));
  const setActiveGroup = (activeGroup: string | null) =>
    state.update((current) => ({ ...current, activeGroup }));
  const setOwnHead = (ownHead: string | null) =>
    state.update((current) => ({ ...current, ownHead }));
  const setBusy = (busy: boolean) =>
    state.update((current) => ({ ...current, busy }));
  const setError = (error: unknown) =>
    state.update((current) => ({ ...current, error }));
  const setDrafted = (kind: keyof Drafts, files: DraftedFiles | null) =>
    state.update((current) => ({
      ...current,
      drafted: { ...current.drafted, [kind]: files },
    }));
  const commitAction: 'amend' | 'commit' =
    mode === 'amend' ? 'amend' : 'commit';
  const git = useGitAction(scope, commitAction, context);
  const generator = useCommitDraft(scope, context, controllers);
  const models = useCommitModels(context);
  const model = resolveCommitModel(
    Option.getOrUndefined(AsyncResult.value(models)),
    commitModel.value,
  );
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
  const working = busy || generator.result.waiting;

  const activeDraft = groups ? drafted.groups : drafted.message;
  const staleDraft =
    commitAction === 'commit' &&
    activeDraft != null &&
    draftIsStale(
      status,
      activeDraft,
      new Set(
        (groups ?? [])
          .filter((group) => done.has(group.id))
          .flatMap((group) => group.paths),
      ),
    );
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

  return {
    scope,
    status,
    onBusy,
    onLookAgain: onLookAgain
      ? Effect.tryPromise({
          try: onLookAgain,
          catch: (cause) =>
            new Cause.UnknownError(cause, gitErrorMessage(cause)),
        })
      : undefined,
    createId,
    mode,
    commitAction,
    git,
    generator,
    models,
    model,
    message,
    amendMessage,
    editingFiles,
    excluded,
    added,
    groups,
    done,
    activeGroup,
    ownHead,
    busy,
    error,
    drafted,
    files,
    commitPaths,
    paths,
    currentMessage,
    uncertain,
    receipt,
    working,
    staleDraft,
    leftUncommitted,
    blocker,
    commitModeBlocker,
    amendModeBlocker,
    controllers,
    form,
    setMode,
    setMessage,
    setAmendMessage,
    setExcluded,
    setAdded,
    setGroups,
    setDone,
    setActiveGroup,
    setOwnHead,
    setBusy,
    setError,
    setDrafted,
    state,
  };
}

export function useCommitForm(
  props: CommitFormProps,
  context: ConnectionContext,
  files: { path: string; paths: string[]; kind: string }[],
  commitModel: CommitModelChoice,
) {
  const controls = useCommitFormState(props, context, files, commitModel);
  const {
    state,
    form,
    commitAction,
    groups,
    working,
    setMode,
    setGroups,
    setDrafted,
    commitPaths,
    setAmendMessage,
    setMessage,
    setAdded,
    setExcluded,
  } = controls;
  return {
    ...controls,
    messageLimit: COMMIT_MESSAGE_BYTES,
    groupLimit: COMMIT_GROUPS,
    commit: () => Effect.runFork(commitForm(controls)),
    generate: () => Effect.runFork(generateCommitForm(controls, 'message')),
    lookAgain: () => Effect.runFork(lookAgainCommitForm(controls)),
    checkOutcome: () => Effect.runFork(recoverCommitForm(controls)),
    setModel: commitModel.set,
    toggleEditingFiles: () =>
      state.update((current) => ({
        ...current,
        editingFiles: !current.editingFiles,
      })),
    setCurrentMessage: (value: string) => {
      if (commitAction === 'amend') setAmendMessage(value);
      else setMessage(value);
    },
    setMode: (value: unknown) => {
      if (value !== 'single' && value !== 'amend' && value !== 'groups') return;
      setMode(value);
      if (value === 'single') {
        setGroups(null);
        setDrafted('groups', null);
      }
      if (value === 'groups' && groups === null && !working)
        Effect.runFork(generateCommitForm(controls, 'groups', commitPaths));
    },
    setIncluded: (path: string, included: boolean) => {
      if (commitAction === 'amend') {
        const next = new Set(form.state.values.added);
        if (included) next.add(path);
        else next.delete(path);
        setAdded(next);
      } else {
        const next = new Set(form.state.values.excluded);
        if (included) next.delete(path);
        else next.add(path);
        setExcluded(next);
      }
    },
    removeGroup: (id: string) =>
      setGroups(
        form.state.values.groups?.filter((group) => group.id !== id) ?? null,
      ),
    setGroupMessage: (id: string, message: string) =>
      setGroups(
        form.state.values.groups?.map((group) =>
          group.id === id ? { ...group, message } : group,
        ) ?? null,
      ),
    moveFile: (paths: string[], id: string) =>
      setGroups(
        form.state.values.groups?.map((group) => ({
          ...group,
          paths: [
            ...group.paths.filter((path) => !paths.includes(path)),
            ...(group.id === id ? paths : []),
          ],
        })) ?? null,
      ),
    addGroup: () =>
      setGroups([
        ...(form.state.values.groups ?? []),
        { id: createId(), message: '', paths: [] },
      ]),
    clearGroups: () => {
      setGroups(null);
      setDrafted('groups', null);
    },
  };
}
