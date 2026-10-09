import { expect, test } from './fixtures.tsx';

test('all changes includes every changed file, including unexplained, deleted and spec files', async ({
  workspace,
  agent,
  server,
}) => {
  await agent.publishArchitecture();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  const drawer = workspace.getByRole('dialog', {
    name: 'Worktree review',
    exact: true,
  });
  await drawer.getByRole('tab', { name: 'Review', exact: true }).click();
  await drawer
    .getByRole('button', { name: 'All changes · 55 files', exact: true })
    .click();
  await expect
    .element(workspace.getByText('55 files', { exact: true }))
    .toBeVisible();
  await workspace
    .getByRole('button', { name: 'Mark all 49 files reviewed', exact: true })
    .click();
  const marks = async () =>
    (await server.reviewedFiles()).marks.map((mark) => mark.path).sort();
  const unmarkAll = workspace.getByRole('button', {
    name: 'Unmark all',
    exact: true,
  });
  await expect.element(unmarkAll).toBeEnabled();
  const saved = marks();
  await expect(saved).resolves.toHaveLength(55);
  await expect(saved).resolves.toContain('scripts/migrate-workspaces.ts');
  await expect(saved).resolves.toContain(
    'packages/workspace/src/legacy-write.ts',
  );
  await expect(saved).resolves.toContain('tests/invite-member.spec.ts');
  await unmarkAll.click();
  await expect
    .element(
      workspace.getByRole('button', {
        name: 'Mark all 55 files reviewed',
        exact: true,
      }),
    )
    .toBeEnabled();
  await expect(marks()).resolves.toEqual([]);
});
