import { expect, test } from './fixtures.ts';

test('the toolbar lists projects from both environments before selection and restores the chosen workspace after a cold launch', async ({
  app,
  device,
  environments,
}) => {
  const first = await environments.start('First', { workspace: true });
  const second = await environments.start('Second', { workspace: true });

  expect(
    await app.run('workspace.yaml', {
      FIRST_PAIRING_LINK: first.link,
      FIRST_ENVIRONMENT_NAME: first.name,
      FIRST_PROJECT_NAME: `${first.name} project`,
      FIRST_WORKTREE_LABEL: 'mobile-first',
      SECOND_PAIRING_LINK: second.link,
      SECOND_ENVIRONMENT_NAME: second.name,
      SECOND_PROJECT_NAME: `${second.name} project`,
      SECOND_WORKTREE_LABEL: 'mobile-second',
    }),
  ).toEqual({
    name: 'Select projects across environments and restore the workspace without leaving Files',
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
