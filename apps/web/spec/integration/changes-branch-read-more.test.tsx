import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('reading more of a long branch keeps its diffs during loading and after a new commit', async ({
  render,
  fetchGate,
  repo,
  server,
  reviewLayout,
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
  const refresh = fetchGate.holdNextPost('/branch-changes/diffs');
  const workspace = await render.workspace();

  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace
    .getByRole('complementary', { name: 'Review sidebar', exact: true })
    .getByRole('tab', { name: 'Changes', exact: true })
    .click();
  await workspace
    .getByRole('complementary', { name: 'Review sidebar', exact: true })
    .getByRole('tab', { name: 'Branch', exact: true })
    .click();
  await expect
    .element(
      workspace.getByRole('button', {
        name: 'notes-00.md · added',
        exact: true,
      }),
    )
    .toHaveAccessibleDescription('Added · Not reviewed');
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
  const code = workspace.getByRole('region', {
    name: 'Code content',
    exact: true,
  });
  reviewLayout.scrollCodeTo(code, 1_000_000);
  await expect
    .element(workspace.getByText('note 25', { exact: true }))
    .toBeVisible();
  await workspace.getByText('note 25', { exact: true }).click();
  await workspace.getByRole('tab', { name: 'Changes', exact: true }).click();
  await workspace
    .getByRole('tablist', { name: 'Open documents', exact: true })
    .getByRole('tab', { name: 'Branch', exact: true })
    .click();
  await expect
    .element(workspace.getByText('note 25', { exact: true }))
    .toBeVisible();
  await userEvent.keyboard('c');
  await expect
    .element(workspace.getByText('notes-25.md · Whole file', { exact: true }))
    .toBeVisible();
  await workspace.getByRole('button', { name: 'Cancel', exact: true }).click();
  const height = reviewLayout.codeScrollHeight(code);
  const position = reviewLayout.codeScrollTop(code);
  refresh.arm();

  await repo.write('zz-after-reading-more.md', 'Added after reading more\n');
  await repo.commit('Add another file after reading more');
  await refresh.requested;
  refresh.release();
  await expect
    .poll(async () => (await server.branchChanges()).files.length)
    .toBe(28);
  await expect
    .element(workspace.getByText('28 files changed', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      workspace.getByRole('button', {
        name: /^(?:Read \d+ more of \d+|Reading…)$/u,
      }),
    )
    .not.toBeInTheDocument();
  await expect
    .poll(() => reviewLayout.codeScrollHeight(code))
    .toBeGreaterThan(height);
  await expect.poll(() => reviewLayout.codeScrollTop(code)).toBe(position);
  reviewLayout.scrollCodeTo(code, 1_000_000);
  await expect
    .element(workspace.getByText('Added after reading more', { exact: true }))
    .toBeVisible();
});
