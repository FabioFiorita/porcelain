import { expect } from 'vitest';
import { test } from '../kit/journey';

test('marking all changed files reviewed marks each one, a file changed on disk asks for review again, and unmarking all clears them', async ({
  pairedPage,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const notes = 'NOTES.md';
  const reviewedAsTheyAre = async () => {
    const [marks, changes] = await Promise.all([
      server.reviewedFiles(),
      server.changes(),
    ]);
    return changes.changes
      .filter((change) =>
        marks.marks.some(
          (mark) =>
            mark.path === change.path &&
            mark.fingerprint === change.fingerprint,
        ),
      )
      .map((change) => change.path)
      .toSorted();
  };
  const marked = async () =>
    (await server.reviewedFiles()).marks.map((mark) => mark.path);

  await repo.write(notes, 'Notes to review\n');
  const markTwo = pairedPage.getByRole('button', {
    name: 'Mark all 2 files reviewed',
  });
  await expect.element(markTwo).toBeVisible();
  await markTwo.click();
  const unmarkAll = pairedPage.getByRole('button', { name: 'Unmark all' });
  await expect.element(unmarkAll).toBeEnabled();
  await expect.poll(reviewedAsTheyAre).toEqual([notes, readme].toSorted());

  await repo.write(notes, 'Notes changed after the review\n');
  const markOne = pairedPage.getByRole('button', {
    name: 'Mark all 1 files reviewed',
  });
  await expect.element(markOne).toBeEnabled();
  await expect.poll(reviewedAsTheyAre).toEqual([readme]);
  await markOne.click();
  await expect.element(unmarkAll).toBeEnabled();
  await expect.poll(reviewedAsTheyAre).toEqual([notes, readme].toSorted());

  await unmarkAll.click();
  await expect.element(markTwo).toBeEnabled();
  await expect.poll(marked).toEqual([]);
});
