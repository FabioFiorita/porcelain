import { expect, test } from './fixtures.tsx';

const count = 205;
const paths = Array.from(
  { length: count },
  (_, index) => `note-${String(index).padStart(3, '0')}.md`,
);

test('All changes shows the diffs of more tracked changes than one diff request holds', async ({
  render,
  repo,
  server,
}) => {
  for (const path of paths) await repo.write(path, `${path} before\n`);
  await repo.commit('Add many notes');
  for (const path of paths) await repo.write(path, `${path} changed\n`);
  await expect
    .poll(async () => (await server.changes()).changes.length)
    .toBe(count);
  const project = await server.project();
  const worktree = project.worktrees.find((entry) => entry.main);
  if (!worktree) throw new Error('The fixture has no main worktree.');
  const opened = (
    await render.route(`/${project.id}/${worktree.id}?entry=all-changes`)
  ).page;
  await opened
    .getByRole('region', { name: '205 uncommitted changes', exact: true })
    .getByRole('button', { name: `${paths[0]} +1 −1`, exact: true })
    .click();
  await expect
    .element(
      opened
        .getByRole('region', { name: 'Code content', exact: true })
        .getByText(`${paths[0]} changed`, { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      opened.getByText('The changes in this document could not be read.', {
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
  await expect
    .poll(
      async () =>
        (await server.changeDiffHits()).filter((hit) => hit.status === 200)
          .length,
    )
    .toBeGreaterThanOrEqual(2);
});
