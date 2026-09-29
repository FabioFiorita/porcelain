import { expect } from 'vitest';
import { test } from '../kit/journey';

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
  await expect
    .element(pairedPage.getByText('2 commits on feature since main'))
    .toBeVisible();

  await pairedPage
    .getByRole('button', { name: 'Compare against the default branch' })
    .click();
  await pairedPage.getByRole('option', { name: 'checkpoint' }).click();
  await expect
    .element(pairedPage.getByText('1 commit on feature since checkpoint'))
    .toBeVisible();
  await expect
    .element(pairedPage.getByRole('button', { name: 'second.md · added' }))
    .toBeVisible();
  await expect
    .element(pairedPage.getByRole('button', { name: 'first.md · added' }))
    .not.toBeInTheDocument();
  const base = () => new URLSearchParams(app.address().query).get('base');
  await expect.poll(base).toBe('refs/heads/checkpoint');

  await pairedPage
    .getByRole('button', { name: 'Compare against checkpoint' })
    .click();
  await pairedPage.getByRole('option', { name: /^main/u }).click();
  await expect
    .element(pairedPage.getByText('2 commits on feature since main'))
    .toBeVisible();
  await expect.poll(base).toBeNull();
});
