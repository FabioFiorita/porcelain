import { ownFileDraftLifetime } from '../../../../spec/kit/file-draft-lifetime.ts';
import { expect, it } from 'vitest';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { FileDrafts } from '@porcelain/client/files';
import { createWorktreeConnection } from '@porcelain/client/transport';
import { deleteWorktree } from './worktree-actions.ts';

const scope = {
  projectId: '11111111-1111-4111-8111-111111111111',
  worktreeId: 'a'.repeat(32),
};
const options = {
  deleteWorktree: true,
  deleteLocalBranch: false,
  deleteRemoteBranch: false,
};
const plan = {
  mainCheckout: false,
  dirty: false,
  unpushed: false,
  fingerprint: 'snapshot',
};
function fixture() {
  const calls: string[] = [];
  const application = ManagedRuntime.make(FileDrafts.layer);
  const drafts = application.runSync(FileDrafts);
  const { connection } = createWorktreeConnection(
    {
      environmentId: '44444444-4444-4444-8444-444444444444',
      timeoutMs: 1000,
      transport: (path) => {
        calls.push(path);
        return Promise.resolve(Response.json({ deleted: false, plan }));
      },
    },
    application.memoMap,
    Layer.empty,
  );
  const registry = AtomRegistry.make();
  ownFileDraftLifetime({ application, connection, registry });
  const command = deleteWorktree({ connection, scope });
  return {
    calls,
    connection,
    retain: (worktreeId = scope.worktreeId) =>
      Effect.runSync(
        drafts.retain({
          environmentId: connection.environmentId,
          scope: { ...scope, worktreeId },
          path: 'note.txt',
          text: 'original',
          fingerprint: 'original',
          writer: {
            write: () =>
              Effect.die('Deletion must not save or discard the draft'),
          },
        }),
      ),
    execute: (confirmed: boolean) => {
      registry.set(command, {
        options,
        ...(confirmed ? { confirmation: { plan, discardChanges: false } } : {}),
      });
      return Effect.runPromise(
        AtomRegistry.getResult(registry, command, { suspendOnWaiting: true }),
      );
    },
  };
}

it('allows a read-only deletion preview but blocks confirmation while the target worktree has an unsaved draft', async () => {
  const subject = fixture();
  const draft = subject.retain();
  try {
    await Effect.runPromise(draft.change('unsaved'));
    expect(await subject.execute(false)).toEqual({ deleted: false, plan });
    await expect(subject.execute(true)).rejects.toThrow(
      'Save or discard unsaved file drafts before changing this worktree.',
    );
    expect(subject.calls).toEqual([
      `/api/worktrees/${scope.worktreeId}/delete`,
    ]);
    expect(draft.state.value).toMatchObject({
      text: 'unsaved',
      savedText: 'original',
    });
  } finally {
    await Effect.runPromise(draft.dispose());
  }
});

it('leaves another worktree draft alone when confirming deletion of the selected worktree', async () => {
  const subject = fixture();
  const draft = subject.retain('b'.repeat(32));
  try {
    await Effect.runPromise(draft.change('other unsaved'));
    await subject.execute(true);
    expect(subject.calls).toEqual([
      `/api/worktrees/${scope.worktreeId}/delete`,
    ]);
    expect(draft.state.value).toMatchObject({
      text: 'other unsaved',
      savedText: 'original',
    });
  } finally {
    await Effect.runPromise(draft.dispose());
  }
});
