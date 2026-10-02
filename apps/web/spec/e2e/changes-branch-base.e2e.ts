import { expect, test } from './fixtures.ts';

test('choosing another base compares the branch against it and the default brings the default comparison back', async ({
  pairedPage,
  app,
  repo,
  server,
}) => {
  await repo.branch('feature');
  await repo.switch('feature');
  await repo.write('first.md', 'first\n');
  await repo.commit('First on the branch');
  await repo.branch('checkpoint');
  await repo.write('second.md', 'second\n');
  await repo.commit('Second on the branch');
  await expect.poll(async () => (await server.branchChanges()).commits).toBe(2);

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Branch', exact: true }).click();
  await expect(
    pairedPage.getByText('2 commits on feature since main', { exact: true }),
  ).toBeVisible();

  await pairedPage
    .getByRole('button', {
      name: 'Compare against the default branch',
      exact: true,
    })
    .click();
  await pairedPage
    .getByRole('option', { name: 'checkpoint', exact: true })
    .click();
  await expect(
    pairedPage.getByText('1 commit on feature since checkpoint', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    pairedPage.getByRole('button', {
      name: 'second.md · added',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    pairedPage.getByRole('button', { name: 'first.md · added', exact: true }),
  ).not.toBeAttached();
  const base = () => new URLSearchParams(app.address().query).get('base');
  await expect.poll(base).toBe('refs/heads/checkpoint');

  await pairedPage
    .getByRole('button', { name: 'Compare against checkpoint', exact: true })
    .click();
  await pairedPage.getByRole('option', { name: /^main/u }).click();
  await expect(
    pairedPage.getByText('2 commits on feature since main', { exact: true }),
  ).toBeVisible();
  await expect.poll(base).toBeNull();
});
