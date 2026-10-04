import { expect, test } from './fixtures.ts';

test('the toolbar workspace picker selects an environment, project and worktree without leaving Files and restores each environment worktree after a cold launch', async ({
  app,
  device,
  environments,
}) => {
  const first = await environments.start('First', { workspace: true });
  const second = await environments.start('Second', { workspace: true });

  const variables = {
    FIRST_PAIRING_LINK: first.link,
    FIRST_ENVIRONMENT_NAME: first.name,
    FIRST_PROJECT_NAME: `${first.name} project`,
    FIRST_WORKTREE_LABEL: 'mobile-first',
    SECOND_PAIRING_LINK: second.link,
    SECOND_ENVIRONMENT_NAME: second.name,
    SECOND_PROJECT_NAME: `${second.name} project`,
    SECOND_WORKTREE_LABEL: 'mobile-second',
  };
  expect(await app.run('pair-environments.yaml', variables)).toEqual({
    name: 'Pair two environments that are online',
    status: 'passed',
  });
  expect(await app.run('workspace.yaml', variables)).toEqual({
    name: 'Select environment project and worktree without leaving Files',
    status: 'passed',
  });
  expect(await app.run('workspace-restore.yaml', variables)).toEqual({
    name: 'Restore each environment worktree after a cold launch',
    status: 'passed',
  });

  const platform = device.kind === 'ipad' ? 'iPadOS' : 'iOS';
  expect(await first.devices()).toEqual([
    { label: 'Native mobile proof', platform },
  ]);
  expect(await second.devices()).toEqual([
    { label: 'Native mobile proof', platform },
  ]);
  expect(
    (await first.nativeHits('GET', '/api/inventory')).length,
  ).toBeGreaterThanOrEqual(2);
  expect(
    (await second.nativeHits('GET', '/api/inventory')).length,
  ).toBeGreaterThanOrEqual(2);
});
