import { expect, test } from './fixtures.tsx';

test('reading more of a long branch keeps the diffs already shown while the next ones load', async ({
  render,
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
  const workspace = await render.workspace();

  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Changes', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Branch', exact: true }).click();
  await workspace.getByRole('button', { name: /^All branch changes/u }).click();
  await expect
    .element(workspace.getByText('A change to review.', { exact: true }))
    .toBeVisible();

  gate.arm();
  await workspace
    .getByRole('button', { name: 'Read 2 more of 2', exact: true })
    .click();
  await gate.requested;
  await expect
    .element(workspace.getByText('A change to review.', { exact: true }))
    .toBeVisible();
  gate.release();
  await expect
    .element(
      workspace.getByRole('button', { name: 'Read 2 more of 2', exact: true }),
    )
    .not.toBeInTheDocument();
  await expect
    .element(
      workspace.getByText('Some patches could not be read.', { exact: true }),
    )
    .not.toBeInTheDocument();
  await expect
    .element(workspace.getByText('A change to review.', { exact: true }))
    .toBeVisible();
});
