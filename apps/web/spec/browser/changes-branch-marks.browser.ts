import { expect } from 'vitest';
import { test } from '../kit/journey';

test('a branch mark belongs to its branch: another branch starts fresh and switching back finds it', async ({
  pairedPage,
  repo,
  server,
}) => {
  await repo.branch('feature');
  await repo.switch('feature');
  await repo.write('notes.md', 'first line\n');
  await repo.commit('Add notes');
  await expect
    .poll(async () => (await server.branchChanges()).head.branch)
    .toBe('refs/heads/feature');

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Branch', exact: true }).click();
  await pairedPage.getByRole('button', { name: 'notes.md · added' }).click();
  await pairedPage
    .getByRole('button', { name: 'Mark notes.md as reviewed' })
    .first()
    .click();
  await expect
    .poll(async () =>
      (await server.reviewedFiles('refs/heads/feature')).marks.map(
        (mark) => mark.path,
      ),
    )
    .toEqual(['notes.md']);

  await repo.branch('copy');
  await repo.switch('copy');
  await expect
    .element(
      pairedPage
        .getByRole('button', { name: 'Mark notes.md as reviewed' })
        .first(),
    )
    .toBeVisible();

  await repo.switch('feature');
  await expect
    .element(
      pairedPage
        .getByRole('button', { name: 'Unmark notes.md as unreviewed' })
        .first(),
    )
    .toBeVisible();
});
