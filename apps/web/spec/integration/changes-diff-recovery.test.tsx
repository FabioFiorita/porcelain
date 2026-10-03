import { expect, test } from './fixtures.tsx';

test('a file changed before its diff request reaches the server recovers to the new diff', async ({
  render,
  fetchGate,
  repo,
  server,
}) => {
  const held = fetchGate.holdNextChangeDiff();
  await repo.write('second.md', 'A second committed file.\n');
  await repo.commit('Add a second file');
  await repo.write('second.md', 'A second changed file.\n');
  const first = 'An earlier change to review.';
  await repo.write(repo.readme.path, `# Sample repository\n\n${first}\n`);
  const opened = await render.workspace();
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened
    .getByRole('button', { name: 'All changes', exact: true })
    .click();
  await expect.element(opened.getByText(first, { exact: true })).toBeVisible();
  held.arm();
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened
    .getByRole('button', {
      name: `${repo.readme.path} · unstaged`,
      exact: true,
    })
    .click();
  await held.requested;
  const before = (await server.changeListHits()).length;
  const diffBefore = (await server.changeDiffHits()).length;
  const rewritten = 'A newer change to review.';
  await repo.write(repo.readme.path, `# Sample repository\n\n${rewritten}\n`);
  held.release();

  await expect
    .poll(async () => (await server.changeDiffHits()).map((hit) => hit.status))
    .toContain(409);
  await expect
    .element(opened.getByText(rewritten, { exact: true }))
    .toBeVisible();
  await expect
    .element(
      opened.getByText('The changes in this document could not be read.', {
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
  await expect
    .element(opened.getByText('Loading changes…', { exact: true }))
    .not.toBeInTheDocument();
  await expect
    .poll(async () =>
      (await server.changeDiffHits()).filter((hit) => hit.status === 409),
    )
    .toHaveLength(1);
  await expect
    .poll(async () =>
      (await server.changeDiffHits())
        .slice(diffBefore)
        .filter((hit) => hit.status === 200),
    )
    .toHaveLength(1);
  await expect
    .poll(async () => (await server.changeListHits()).length - before)
    .toBe(1);
});
