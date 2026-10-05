import { runRequest } from '@porcelain/client/transport';
import { expect } from 'vitest';
import { QueryClient } from '@tanstack/query-core';
import { test } from '@porcelain/server/kit/server-test';
import {
  projectCommands,
  inventoryQueryOptions,
  setFilePreference,
  filePreferencesQueryOptions,
} from '@porcelain/client/projects';
import { connection } from '../kit/connection.ts';

test('register, rename, pin and remove a repository through the shared project owner', async ({
  server,
  session,
}) => {
  const { connected } = await connection(server, session);
  const cache = new QueryClient();
  await cache.query(inventoryQueryOptions(connected));
  const commands = projectCommands(connected, cache);
  const project = await runRequest(
    commands.register(session.repository),
    connected.request().signal,
  );
  expect(project.id).toBe(session.projectId);
  expect(
    (
      await runRequest(
        commands.rename({ projectId: project.id, name: 'Shared project' }),
        connected.request().signal,
      )
    ).name,
  ).toBe('Shared project');
  expect(
    (await cache.query(inventoryQueryOptions(connected))).projects.find(
      (entry) => entry.id === project.id,
    )?.name,
  ).toBe('Shared project');
  await runRequest(
    setFilePreference(connected, cache, project.id, {
      path: session.fixture.readme.path,
      flag: 'pinned',
      value: true,
    }),
    connected.request().signal,
  );
  expect(
    (await cache.query(filePreferencesQueryOptions(connected, project.id)))
      .preferences,
  ).toContainEqual({
    path: session.fixture.readme.path,
    hidden: false,
    pinned: true,
  });
  await runRequest(commands.remove(project.id), connected.request().signal);
  expect(
    (await cache.query(inventoryQueryOptions(connected))).projects,
  ).toEqual([]);
});
