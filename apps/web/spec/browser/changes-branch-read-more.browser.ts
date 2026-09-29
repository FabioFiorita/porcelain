import { expect } from 'vitest';
import { test } from '../kit/journey';

test('reading more of a long branch keeps the diffs already shown while the next ones load', async ({
  app,
  fetchGate,
  repo,
  server,
}) => {
  await repo.branch('feature');
  await repo.switch('feature');
  for (let index = 0; index < 26; index += 1)
    await repo.write(
      `notes-${String(index).padStart(2, '0')}.md`,
      `note ${index}\n`,
    );
  await repo.commit('Add many notes');
  await expect
    .poll(async () => (await server.branchChanges()).files.length)
    .toBe(27);
  const gate = fetchGate.holdNextPost('/branch-changes/diffs');
  const pairedPage = await app.open(await app.link('this'));

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Branch', exact: true }).click();
  await pairedPage
    .getByRole('button', { name: /^All branch changes/u })
    .click();
  await expect
    .element(pairedPage.getByText('A change to review.'))
    .toBeVisible();

  gate.arm();
  await pairedPage.getByRole('button', { name: 'Read 2 more of 2' }).click();
  await gate.requested;
  await expect
    .element(pairedPage.getByText('A change to review.'))
    .toBeVisible();
  gate.release();
  await expect
    .element(pairedPage.getByRole('button', { name: 'Read 2 more of 2' }))
    .not.toBeInTheDocument();
  await expect
    .element(pairedPage.getByText('Some patches could not be read.'))
    .not.toBeInTheDocument();
  await expect
    .element(pairedPage.getByText('A change to review.'))
    .toBeVisible();
});
