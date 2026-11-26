import { expect, test } from './fixtures.tsx';

test('marking all changed files reviewed marks each one, a file changed on disk asks for review again, and unmarking all clears them', async ({
  workspace,
  repo,
  server,
  reviewLayout,
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
  await reviewLayout.openAllChanges();
  await workspace
    .getByRole('button', { name: /^File review actions:/ })
    .click();
  const markTwo = workspace.getByRole('button', {
    name: 'Mark all 2 files reviewed',
    exact: true,
  });
  await expect.element(markTwo).toBeVisible();
  await markTwo.click();
  const unmarkAll = workspace.getByRole('button', {
    name: 'Unmark all',
    exact: true,
  });
  await expect.element(unmarkAll).toBeEnabled();
  await expect.poll(reviewedAsTheyAre).toEqual([notes, readme].toSorted());

  await repo.write(notes, 'Notes changed after the review\n');
  const markOne = workspace.getByRole('button', {
    name: 'Mark all 1 file reviewed',
    exact: true,
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

test('All changes on a worktree with a ready walkthrough keeps its file table and marks every file', async ({
  repo,
  codingTool,
  render,
  server,
  reviewLayout,
}) => {
  await repo.write('NOTES.md', 'Notes to review\n');
  await codingTool.install();
  const workspace = await render.workspace();
  await workspace
    .getByRole('button', { name: 'Write walkthrough', exact: true })
    .click();
  await expect
    .element(
      workspace.getByRole('heading', {
        name: /^Teach the sample to explain itself$/,
      }),
    )
    .toBeVisible();
  await reviewLayout.openAllChanges();
  await expect
    .element(
      workspace.getByRole('region', {
        name: '2 uncommitted changes',
        exact: true,
      }),
    )
    .toBeVisible();
  await workspace
    .getByRole('button', { name: /^File review actions:/ })
    .click();
  await workspace
    .getByRole('button', { name: 'Mark all 2 files reviewed', exact: true })
    .click();
  await expect
    .poll(async () =>
      (await server.reviewedFiles()).marks.map((mark) => mark.path).toSorted(),
    )
    .toEqual(['NOTES.md', 'README.md']);
});
