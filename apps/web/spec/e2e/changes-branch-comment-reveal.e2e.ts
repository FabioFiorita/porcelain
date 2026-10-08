import { expect, test } from './fixtures.ts';

test('showing a branch comment opens its file against the base it was written against', async ({
  pairedPage,
  app,
  repo,
  server,
}) => {
  await repo.branch('checkpoint');
  await repo.branch('feature');
  await repo.switch('feature');
  await repo.write('notes.md', 'first line\n');
  await repo.commit('Add notes');
  await expect.poll(async () => (await server.branchChanges()).commits).toBe(1);
  const search = () => new URLSearchParams(app.address().query);

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Changes', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Branch', exact: true }).click();
  await pairedPage
    .getByRole('button', {
      name: 'Compare against the default branch',
      exact: true,
    })
    .click();
  await pairedPage
    .getByRole('option', { name: 'checkpoint', exact: true })
    .click();
  await expect.poll(() => search().get('base')).toBe('refs/heads/checkpoint');
  await pairedPage
    .getByRole('button', { name: 'notes.md · added', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Comment on notes.md (added)', exact: true })
    .click();
  await pairedPage
    .getByRole('textbox', { name: 'Comment', exact: true })
    .fill('Against the checkpoint');
  await pairedPage
    .getByRole('button', { name: 'Comment', exact: true })
    .click();
  await expect
    .poll(async () =>
      (await server.commentThreads()).map((thread) => thread.anchor.comparison),
    )
    .toEqual([{ kind: 'branch', base: 'refs/heads/checkpoint' }]);

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Changes', exact: true }).click();
  await pairedPage
    .getByRole('button', { name: 'Compare against checkpoint', exact: true })
    .click();
  await pairedPage.getByRole('option', { name: /^main/u }).click();
  await expect.poll(() => search().get('base')).toBeNull();

  await pairedPage.getByRole('tab', { name: /^Comments/u }).click();
  await pairedPage
    .getByRole('button', { name: /^notes\.md Whole file/u })
    .click();
  await expect.poll(() => search().get('base')).toBe('refs/heads/checkpoint');
  await expect.poll(() => search().get('entry')).toBe('branch:notes.md');
});
