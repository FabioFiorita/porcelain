import {
  COMMIT_MESSAGE_BYTES,
  COMMIT_GROUPS,
} from '@porcelain/contracts/shared';
import { useForm, useSelector } from '@tanstack/react-form';
import { usePreferences } from '@/shared/workspace/preferences';
import { createId } from '@/shared/lib/id';
import type { GitContext } from '../api';
import { resolveCommitModel } from '../rules/commit-model';
import {
  commitFormDefaults,
  type CommitFormProps,
  type CommitMode,
  type Group,
} from '../rules/commit-form';
import { gitActionBlocker } from '../rules/status';
import { expectationFor, receiptFailed, receiptWords } from '../rules/feedback';
import { useCommitState, commitRuntime } from '../store';
import { useCommitModels } from '../queries/git-actions';
import { useGitAction } from './run-action';
import { useCommitDraft } from './commit-draft';
const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

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
  context: GitContext,
  files: { path: string; paths: string[]; kind: string }[],
) {
  const form = useForm({
    defaultValues: commitFormDefaults(
      action,
      initialMessage,
      lastCommitMessage,
    ),
  });
  const { state, controllers } = commitRuntime(form);
  const { mode, message, amendMessage, excluded, added, groups } = useSelector(
    form.store,
    (state) => state.values,
  );
  const { done, activeGroup, ownHead, busy, error, draftToken, editingFiles } =
    useCommitState(state);
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
    state.setState((current) => ({
      done: typeof value === 'function' ? value(current.done) : value,
    }));
  const setActiveGroup = (activeGroup: string | null) =>
    state.setState({ activeGroup });
  const setOwnHead = (ownHead: string | null) => state.setState({ ownHead });
  const setBusy = (busy: boolean) => state.setState({ busy });
  const setError = (error: unknown) => state.setState({ error });
  const setDraftToken = (draftToken: string | null) =>
    state.setState({ draftToken });
  const commitAction: 'amend' | 'commit' =
    mode === 'amend' ? 'amend' : 'commit';
  const git = useGitAction(scope, commitAction, context);
  const generator = useCommitDraft(scope, context, controllers);
  const models = useCommitModels(context);
  const { preferences } = usePreferences();
  const model = resolveCommitModel(models.data, preferences.commitModel);
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

  return {
    scope,
    status,
    onBusy,
    onLookAgain,
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
    draftToken,
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
    setDraftToken,
    state,
  };
}

async function generate(
  controls: ReturnType<typeof useCommitFormState>,
  mode: 'message' | 'groups',
  selectedPaths = controls.paths,
) {
  const {
    model,
    working,
    setBusy,
    setError,
    generator,
    status,
    setDraftToken,
    setDone,
    setActiveGroup,
    setMessage,
    setGroups,
  } = controls;
  if (!model || !selectedPaths.length || working) return;
  setBusy(true);
  setError(null);
  try {
    const result = await generator.submit({
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

async function commit(controls: ReturnType<typeof useCommitFormState>) {
  const {
    working,
    uncertain,
    setBusy,
    setError,
    currentMessage,
    mode,
    commitAction,
    model,
    paths,
    generator,
    status,
    setMessage,
    setDraftToken,
    groups,
    done,
    ownHead,
    onBusy,
    setActiveGroup,
    git,
    setOwnHead,
    setDone,
  } = controls;
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
      const result = await generator.submit({
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

async function lookAgain(controls: ReturnType<typeof useCommitFormState>) {
  const {
    onLookAgain,
    working,
    setBusy,
    setError,
    git,
    setOwnHead,
    setDraftToken,
  } = controls;
  if (!onLookAgain || working) return;
  setBusy(true);
  setError(null);
  try {
    await onLookAgain();
    git.startNew();
    setOwnHead(null);
    setDraftToken(null);
  } catch (error) {
    setError(error);
  } finally {
    setBusy(false);
  }
}

async function checkOutcome(controls: ReturnType<typeof useCommitFormState>) {
  const { setError, git, activeGroup, setDone, setActiveGroup } = controls;
  setError(null);
  try {
    const receipt = await git.recover.submit();
    if (activeGroup && ['succeeded', 'no-change'].includes(receipt.state)) {
      setDone((current) => new Set([...current, activeGroup]));
      setActiveGroup(null);
    }
  } catch (error) {
    setError(error);
  }
}

export function useCommitForm(
  props: CommitFormProps,
  context: GitContext,
  files: { path: string; paths: string[]; kind: string }[],
) {
  const controls = useCommitFormState(props, context, files);
  const {
    state,
    form,
    commitAction,
    groups,
    working,
    setMode,
    setGroups,
    setDraftToken,
    commitPaths,
    setAmendMessage,
    setMessage,
    setAdded,
    setExcluded,
  } = controls;
  const { setPreference } = usePreferences();
  return {
    ...controls,
    messageLimit: COMMIT_MESSAGE_BYTES,
    groupLimit: COMMIT_GROUPS,
    commit: () => void commit(controls),
    generate: () => void generate(controls, 'message'),
    lookAgain: () => void lookAgain(controls),
    checkOutcome: () => void checkOutcome(controls),
    setModel: (value: string) => setPreference('commitModel', value),
    toggleEditingFiles: () =>
      state.setState((current) => ({ editingFiles: !current.editingFiles })),
    setCurrentMessage: (value: string) => {
      if (commitAction === 'amend') setAmendMessage(value);
      else setMessage(value);
    },
    setMode: (value: unknown) => {
      if (value !== 'single' && value !== 'amend' && value !== 'groups') return;
      setMode(value);
      if (value === 'single') {
        setGroups(null);
        setDraftToken(null);
      }
      if (value === 'groups' && groups === null && !working)
        void generate(controls, 'groups', commitPaths);
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
      setDraftToken(null);
    },
  };
}
