import { expect, test } from './fixtures.tsx';

test('all changes includes every changed file, including unexplained, deleted and spec files', async ({
  workspace,
  agent,
  server,
}) => {
  await agent.publishArchitecture();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Review', exact: true }).click();
  await workspace
    .getByRole('button', { name: 'All changes · 55 files', exact: true })
    .click();
  await expect
    .element(workspace.getByText('55 files', { exact: true }))
    .toBeVisible();
  await workspace
    .getByRole('button', { name: 'Mark all 55 files reviewed', exact: true })
    .click();
  const marks = async () =>
    (await server.reviewedFiles()).marks.map((mark) => mark.path).sort();
  await expect.poll(marks).toHaveLength(55);
  await expect.poll(marks).toContain('scripts/migrate-workspaces.ts');
  await expect.poll(marks).toContain('packages/workspace/src/legacy-write.ts');
  await expect.poll(marks).toContain('tests/invite-member.spec.ts');
  await workspace
    .getByRole('button', { name: 'Unmark all', exact: true })
    .click();
  await expect.poll(marks).toEqual([]);
});
