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
  const opened = await render.workspace();
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Changes', exact: true }).click();
  await opened
    .getByRole('button', { name: 'All changes', exact: true })
    .click();
  await expect
    .element(opened.getByText(`${paths[0]} changed`, { exact: true }))
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
