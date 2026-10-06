import { afterEach, expect } from 'vitest';
import { Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { test } from '@porcelain/server/kit/server-test';
import {
  registerProject,
  renameProject,
  removeProject,
  readInventory,
  setFilePreference,
  readFilePreferences,
} from '@porcelain/client/projects';
import { connection } from '../kit/connection.ts';

const registries = new Set<AtomRegistry.AtomRegistry>();
afterEach(() => {
  for (const registry of registries) registry.dispose();
  registries.clear();
});
test('register, rename, pin and remove a repository through the shared project owner', async ({
  server,
  session,
}) => {
  const { connected } = await connection(server, session);
  const registry = AtomRegistry.make();
  registries.add(registry);
  const inventory = readInventory(connected);
  registry.mount(inventory);
  await Effect.runPromise(
    AtomRegistry.getResult(registry, inventory, { suspendOnWaiting: true }),
  );
  const register = registerProject(connected);
  registry.set(register, session.repository);
  const project = await Effect.runPromise(
    AtomRegistry.getResult(registry, register, { suspendOnWaiting: true }),
  );
  expect(project.id).toBe(session.projectId);
  const rename = renameProject(connected);
  registry.set(rename, { projectId: project.id, name: 'Shared project' });
  expect(
    (
      await Effect.runPromise(
        AtomRegistry.getResult(registry, rename, { suspendOnWaiting: true }),
      )
    ).name,
  ).toBe('Shared project');
  expect(
    (
      await Effect.runPromise(
        AtomRegistry.getResult(registry, inventory, { suspendOnWaiting: true }),
      )
    ).projects.find((entry) => entry.id === project.id)?.name,
  ).toBe('Shared project');
  const preferences = readFilePreferences({
    connection: connected,
    projectId: project.id,
  });
  registry.mount(preferences);
  await Effect.runPromise(
    AtomRegistry.getResult(registry, preferences, { suspendOnWaiting: true }),
  );
  const preference = setFilePreference({
    connection: connected,
    projectId: project.id,
  });
  registry.set(preference, {
    path: session.fixture.readme.path,
    flag: 'pinned',
    value: true,
  });
  await Effect.runPromise(
    AtomRegistry.getResult(registry, preference, { suspendOnWaiting: true }),
  );
  expect(
    (
      await Effect.runPromise(
        AtomRegistry.getResult(registry, preferences, {
          suspendOnWaiting: true,
        }),
      )
    ).preferences,
  ).toContainEqual({
    path: session.fixture.readme.path,
    hidden: false,
    pinned: true,
  });
  const remove = removeProject(connected);
  registry.set(remove, project.id);
  await Effect.runPromise(
    AtomRegistry.getResult(registry, remove, { suspendOnWaiting: true }),
  );
  expect(
    (
      await Effect.runPromise(
        AtomRegistry.getResult(registry, inventory, { suspendOnWaiting: true }),
      )
    ).projects,
  ).toEqual([]);
});
