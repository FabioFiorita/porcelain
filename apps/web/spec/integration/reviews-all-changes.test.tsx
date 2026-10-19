import { expect, test } from './fixtures.tsx';

test('all changes includes every changed file, including unexplained, deleted and spec files', async ({
  workspace,
  agent,
  server,
  repo,
}) => {
  await agent.publishArchitecture();
  await repo.remove('packages/workspace/src/actor.ts');
  const spec = 'tests/publish-note.spec.ts';
  await repo.write(spec, `${await repo.read(spec)}\n// Follow-up spec edit.\n`);
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  const drawer = workspace.getByRole('dialog', {
    name: 'Worktree review',
    exact: true,
  });
  await drawer.getByRole('tab', { name: 'Review', exact: true }).click();
  await drawer
    .getByRole('button', { name: 'All changes · 5 files', exact: true })
    .click();
  await expect
    .element(workspace.getByText('5 files', { exact: true }))
    .toBeVisible();
  await workspace
    .getByRole('button', { name: 'Mark all 5 files reviewed', exact: true })
    .click();
  const marks = async () =>
    (await server.reviewedFiles()).marks.map((mark) => mark.path).sort();
  const unmarkAll = workspace.getByRole('button', {
    name: 'Unmark all',
    exact: true,
  });
  await expect.element(unmarkAll).toBeEnabled();
  await expect(marks()).resolves.toEqual([
    'packages/workspace/src/actor.ts',
    'packages/workspace/src/policy.ts',
    'packages/workspace/src/revoke-access.ts',
    'scripts/migrate-workspaces.ts',
    'tests/publish-note.spec.ts',
  ]);
  await unmarkAll.click();
  await expect
    .element(
      workspace.getByRole('button', {
        name: 'Mark all 5 files reviewed',
        exact: true,
      }),
    )
    .toBeEnabled();
  await expect(marks()).resolves.toEqual([]);
});
