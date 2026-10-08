import { expect, test } from './fixtures.tsx';

test('a whole-branch comment being written survives a new commit and is saved at the new tip', async ({
  workspace,
  repo,
  server,
}) => {
  const draft = 'Split the notes before merging';
  await repo.branch('feature');
  await repo.switch('feature');
  await repo.write('notes.md', 'first line\n');
  await repo.commit('Add notes');
  await expect.poll(async () => (await server.branchChanges()).commits).toBe(1);

  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Changes', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Comments', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Branch', exact: true }).click();
  await workspace
    .getByRole('button', { name: 'Comment on the whole branch', exact: true })
    .click();
  const comment = workspace.getByRole('textbox', {
    name: 'Comment',
    exact: true,
  });
  await comment.fill(draft);

  await repo.write('notes.md', 'first line\nsecond line\n');
  await repo.commit('Extend notes');
  await expect.poll(async () => (await server.branchChanges()).commits).toBe(2);
  const tip = (await server.branchChanges()).head.oid;
  await expect
    .element(
      workspace.getByText(`Whole branch · at ${tip.slice(0, 7)}`, {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect.element(comment).toHaveValue(draft);

  await workspace.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect
    .element(workspace.getByText(draft, { exact: true }))
    .toBeVisible();
  await expect
    .poll(async () =>
      (await server.commentThreads()).map((thread) => thread.anchor.revision),
    )
    .toEqual([tip]);
});
