import type { Atom } from 'effect/reactivity';
import type { generateCommitDraft } from './git-actions.ts';
import type { CommitDraft } from '../rules/git-action.ts';
import type { gitActionCommands } from './git-action-controller.ts';
import { Cause, Effect } from 'effect';
import type { CommitDraftInput } from '../rules/git-action.ts';
import type {
  Group,
  CommitMode,
  Drafts,
  DraftedFiles,
} from '../rules/commit-form.ts';
import type { GitActionStatus } from '../rules/status.ts';
import { draftIsStale } from '../rules/commit-form.ts';
import {
  expectationFor,
  receiptFailed,
  receiptWords,
} from '../rules/feedback.ts';

type CommitControls = {
  readonly model: CommitDraftInput['model'] | undefined;
  readonly working: boolean;
  readonly uncertain: boolean;
  readonly paths: string[];
  readonly status: GitActionStatus;
  readonly currentMessage: string;
  readonly mode: CommitMode;
  readonly commitAction: 'commit' | 'amend';
  readonly groups: Group[] | null;
  readonly done: ReadonlySet<string>;
  readonly ownHead: string | null;
  readonly activeGroup: string | null;
  readonly generator: {
    submit: (
      input: CommitDraftInput,
    ) => Effect.Effect<
      CommitDraft,
      Atom.Failure<ReturnType<typeof generateCommitDraft>>
    >;
  };
  readonly git: ReturnType<typeof gitActionCommands>;
  readonly onLookAgain: Effect.Effect<void, Cause.UnknownError> | undefined;
  readonly onBusy: (value: boolean) => void;
  readonly setBusy: (value: boolean) => void;
  readonly setError: (value: unknown) => void;
  readonly setDrafted: (kind: keyof Drafts, files: DraftedFiles | null) => void;
  readonly setDone: (
    value:
      | ReadonlySet<string>
      | ((current: ReadonlySet<string>) => ReadonlySet<string>),
  ) => void;
  readonly setActiveGroup: (value: string | null) => void;
  readonly setMessage: (value: string) => void;
  readonly setGroups: (value: Group[] | null) => void;
  readonly setOwnHead: (value: string | null) => void;
  readonly createId: () => string;
};

const showFailure =
  (controls: CommitControls) => (cause: Cause.Cause<unknown>) =>
    Effect.sync(() => {
      if (!Cause.hasInterrupts(cause)) controls.setError(Cause.squash(cause));
    });

export const generateCommitForm = Effect.fn('CommitForm.generate')(
  function* (
    controls: CommitControls,
    mode: 'message' | 'groups',
    selectedPaths: string[] = controls.paths,
  ) {
    const {
      model,
      working,
      setBusy,
      setError,
      generator,
      status,
      setDrafted,
      setDone,
      setActiveGroup,
      setMessage,
      setGroups,
    } = controls;
    if (!model || !selectedPaths.length || working) return;
    setBusy(true);
    setError(null);
    yield* Effect.addFinalizer(() => Effect.sync(() => setBusy(false)));
    const result = yield* generator.submit({
      mode,
      model,
      paths: selectedPaths,
      expectedStatusToken: status.statusToken,
    });
    setDrafted(mode, result.expectedFiles);
    setDone(new Set());
    setActiveGroup(null);
    if (mode === 'message') {
      setMessage(result.groups[0]?.message ?? '');
      setGroups(null);
    } else
      setGroups(
        result.groups.map((group) => ({ ...group, id: controls.createId() })),
      );
  },
  Effect.scoped,
  (effect, controls) => effect.pipe(Effect.catchCause(showFailure(controls))),
);

export const commitForm = Effect.fn('CommitForm.commit')(
  function* (controls: CommitControls) {
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
      setDrafted,
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
    yield* Effect.addFinalizer(() => Effect.sync(() => setBusy(false)));
    let text = currentMessage;
    if (mode !== 'groups' && !text.trim()) {
      if (commitAction === 'amend')
        return yield* Effect.fail(
          new Cause.UnknownError(
            undefined,
            'Give the amended commit a message.',
          ),
        );
      if (!model || !paths.length)
        return yield* Effect.fail(
          new Cause.UnknownError(
            undefined,
            'Give every commit a message and at least one file.',
          ),
        );
      const result = yield* generator.submit({
        mode: 'message',
        model,
        paths,
        expectedStatusToken: status.statusToken,
      });
      text = result.groups[0]?.message ?? '';
      setMessage(text);
      setDrafted('message', result.expectedFiles);
      if (draftIsStale(status, result.expectedFiles)) return;
    }
    const pending =
      commitAction === 'amend'
        ? [{ id: 'single', message: text, paths }]
        : mode === 'groups' && groups
          ? groups.filter((group) => !done.has(group.id))
          : [{ id: 'single', message: text, paths }];
    let expectedHead = ownHead ?? status.headOid ?? null;
    onBusy(true);
    yield* Effect.addFinalizer(() => Effect.sync(() => onBusy(false)));
    for (const group of pending) {
      if (
        !group.message.trim() ||
        (commitAction !== 'amend' &&
          status.inProgress !== 'merge' &&
          !group.paths.length)
      )
        return yield* Effect.fail(
          new Cause.UnknownError(
            undefined,
            'Give every commit a message and at least one file.',
          ),
        );
      setActiveGroup(group.id);
      const result = yield* git.run(
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
      if (receiptFailed(result))
        return yield* Effect.fail(
          new Cause.UnknownError(undefined, receiptWords(result)),
        );
      if (result.result?.headOid) {
        expectedHead = result.result.headOid;
        setOwnHead(expectedHead);
      }
      setDone((current) => new Set([...current, group.id]));
      setActiveGroup(null);
    }
  },
  Effect.scoped,
  (effect, controls) => effect.pipe(Effect.catchCause(showFailure(controls))),
);

export const lookAgainCommitForm = Effect.fn('CommitForm.lookAgain')(
  function* (controls: CommitControls) {
    const { onLookAgain, working, setBusy, setError, git, setOwnHead } =
      controls;
    if (!onLookAgain || working) return;
    setBusy(true);
    setError(null);
    yield* Effect.addFinalizer(() => Effect.sync(() => setBusy(false)));
    yield* onLookAgain;
    yield* git.startNew();
    setOwnHead(null);
  },
  Effect.scoped,
  (effect, controls) => effect.pipe(Effect.catchCause(showFailure(controls))),
);

export const recoverCommitForm = Effect.fn('CommitForm.recover')(
  function* (controls: CommitControls) {
    const { setError, git, activeGroup, setDone, setActiveGroup } = controls;
    setError(null);
    const receipt = yield* git.recover();
    if (activeGroup && ['succeeded', 'no-change'].includes(receipt.state)) {
      setDone((current) => new Set([...current, activeGroup]));
      setActiveGroup(null);
    }
  },
  (effect, controls) => effect.pipe(Effect.catchCause(showFailure(controls))),
);
