import { afterEach, expect, it } from 'vitest';
import { Effect, Layer, ManagedRuntime, Option } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import { FileDrafts } from '@porcelain/client/files';
import { ContentChangedError } from '@porcelain/files/errors';
import {
  createWorktreeConnection,
  type RuntimeConnection,
  type Transport,
} from '@porcelain/client/transport';
import { InventorySeed, readInventory } from '@porcelain/client/projects';
import { removeProject } from './projects.ts';

const projectId = '00000000-0000-4000-8000-000000000001';
const worktreeId = 'a'.repeat(32);
const initial: ReadInventoryResponse = {
  environmentId: '44444444-4444-4444-8444-444444444444',
  environment: { name: 'Computer', custom: false },
  projects: [
    { id: projectId, name: 'Project', available: true, worktrees: [] },
  ],
};
const owned = new Set<{
  connection: RuntimeConnection;
  registry: AtomRegistry.AtomRegistry;
  application: ManagedRuntime.ManagedRuntime<FileDrafts, never>;
}>();
afterEach(async () => {
  for (const { connection, registry, application } of owned) {
    registry.dispose();
    await connection.close();
    await application.dispose();
  }
  owned.clear();
});
function fixture(steps: string[], transport?: Transport) {
  let deleted = false;
  const application = ManagedRuntime.make(FileDrafts.layer);
  application.runSync(FileDrafts);
  const { connection } = createWorktreeConnection(
    {
      environmentId: '44444444-4444-4444-8444-444444444444',
      timeoutMs: 10_000,
      transport:
        transport ??
        ((path) => {
          if (path === '/api/inventory')
            return Promise.resolve(
              Response.json({
                ...initial,
                projects: deleted ? [] : initial.projects,
              }),
            );
          steps.push(path);
          deleted = true;
          return Promise.resolve(Response.json({ deleted: true }));
        }),
    },
    application.memoMap,
    Layer.empty,
  );
  connection.atoms.addGlobalLayer(
    Layer.succeed(InventorySeed, Option.some(initial)),
  );
  const registry = AtomRegistry.make();
  owned.add({ connection, registry, application });
  const atom = removeProject(connection);
  return {
    connection,
    application,
    registry,
    remove: () => {
      registry.set(atom, projectId);
      return Effect.runPromise(
        AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
      );
    },
    inventory: () =>
      Effect.runPromise(
        AtomRegistry.getResult(registry, readInventory(connection), {
          suspendOnWaiting: true,
        }),
      ),
  };
}
function retain(
  subject: ReturnType<typeof fixture>,
  steps: string[],
  other = false,
  conflict = false,
) {
  return Effect.runSync(
    subject.application.runSync(FileDrafts).retain({
      environmentId: subject.connection.environmentId,
      scope: { projectId: other ? 'other-project' : projectId, worktreeId },
      path: 'README.md',
      text: 'original',
      fingerprint: 'version-1',
      writer: {
        write: () =>
          conflict
            ? Effect.fail(new ContentChangedError())
            : Effect.sync(() => {
                steps.push(other ? 'other draft saved' : 'draft saved');
                return 'version-2';
              }),
      },
    }),
  );
}
it('saves a retained project draft before removing the project and publishing confirmed inventory', async () => {
  const steps: string[] = [];
  const subject = fixture(steps);
  const draft = retain(subject, steps);
  try {
    await Effect.runPromise(draft.change('updated'));
    expect(await subject.remove()).toEqual({ deleted: true });
    expect(steps).toEqual(['draft saved', `/api/projects/${projectId}`]);
    expect(draft.state.value).toMatchObject({
      text: 'updated',
      savedText: 'updated',
      fingerprint: 'version-2',
    });
    expect((await subject.inventory()).projects).toEqual([]);
  } finally {
    await Effect.runPromise(draft.dispose());
  }
});
it('keeps the project and its unsaved draft when a save conflicts', async () => {
  const steps: string[] = [];
  const subject = fixture(steps);
  const draft = retain(subject, steps, false, true);
  try {
    await Effect.runPromise(draft.change('unsaved'));
    await expect(subject.remove()).rejects.toThrow(
      'Save or discard unsaved file drafts before removing this project.',
    );
    expect(steps).toEqual([]);
    expect(await subject.inventory()).toEqual(initial);
    expect(draft.state.value).toMatchObject({
      text: 'unsaved',
      savedText: 'original',
      fingerprint: 'version-1',
    });
  } finally {
    await Effect.runPromise(draft.dispose());
  }
});
it('leaves another project draft alone when removing the selected project', async () => {
  const steps: string[] = [];
  const subject = fixture(steps);
  const draft = retain(subject, steps, true);
  try {
    await Effect.runPromise(draft.change('unsaved'));
    expect(await subject.remove()).toEqual({ deleted: true });
    expect(steps).toEqual([`/api/projects/${projectId}`]);
    expect(draft.state.value).toMatchObject({
      text: 'unsaved',
      savedText: 'original',
      fingerprint: 'version-1',
    });
  } finally {
    await Effect.runPromise(draft.dispose());
  }
});
