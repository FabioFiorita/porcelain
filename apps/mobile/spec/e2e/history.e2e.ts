import { Schema } from 'effect';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { expect, test } from './fixtures.ts';

test('History opens a commit and file diff in the selected workspace and returns through the native stack', async ({
  app,
  environments,
}) => {
  const environment = await environments.start('History', { workspace: true });
  const inventory = Schema.decodeUnknownSync(readInventoryResponseSchema)(
    (
      await environment.server.read(environment.recorder, {
        method: 'GET',
        path: '/api/inventory',
      })
    ).body,
  );
  const project = inventory.projects.find(
    (candidate) => candidate.name === `${environment.name} project`,
  );
  const worktree = project?.worktrees.find((candidate) => candidate.main);
  if (!project || !worktree)
    throw new Error('The fixture History worktree is missing.');
  const session = environment.server.session(environment.recorder, {
    projectId: project.id,
    worktreeId: worktree.id,
  });
  await session.writeFile('history-proof.txt', 'History native diff proof\n');
  await session.git('add', 'history-proof.txt');
  await session.git(
    'commit',
    '-m',
    'Add history native proof',
    '-m',
    'Commit detail body proof',
  );
  expect(
    await app.run('history.yaml', {
      PAIRING_LINK: environment.link,
      ENVIRONMENT_NAME: environment.name,
      PROJECT_NAME: `${environment.name} project`,
      WORKTREE_LABEL: 'main',
    }),
  ).toEqual({
    name: 'Browse a commit and diff with native back navigation',
    status: 'passed',
  });
  expect(
    (await environment.nativeHits('GET', '/api/worktrees/:worktreeId/commits'))
      .length,
  ).toBeGreaterThan(0);
  expect(
    (
      await environment.nativeHits(
        'GET',
        '/api/worktrees/:worktreeId/commits/:oid/files',
      )
    ).length,
  ).toBeGreaterThan(0);
  expect(
    (
      await environment.nativeHits(
        'POST',
        '/api/worktrees/:worktreeId/commits/:oid/diffs',
      )
    ).length,
  ).toBeGreaterThan(0);
});
