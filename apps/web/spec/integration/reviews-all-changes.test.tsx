import { page, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

for (const surface of ['Files', 'History'] as const) {
  test(`a clean worktree keeps Changes open and reaches ${surface} from its notice`, async ({
    repo,
    render,
  }) => {
    await repo.commit('Commit the sample change');
    const workspace = await render.workspace();
    const changes = workspace
      .getByRole('tablist', { name: 'Open documents', exact: true })
      .getByRole('tab', { name: 'Changes', exact: true });
    await expect
      .element(
        workspace.getByRole('heading', {
          name: 'No changes to review',
          exact: true,
        }),
      )
      .toBeVisible();
    await changes.click();
    await userEvent.keyboard('{Alt>}w{/Alt}');
    await expect.element(changes).toBeVisible();
    await expect
      .element(
        workspace.getByRole('button', { name: 'Close Changes', exact: true }),
      )
      .not.toBeInTheDocument();
    await expect
      .element(
        workspace.getByText(
          'main matches its last commit. Browse files or history from the right.',
          { exact: true },
        ),
      )
      .toBeVisible();
    await workspace
      .getByRole('button', { name: new RegExp(`^${surface}`) })
      .click();
    const panel = workspace.getByRole('dialog', {
      name: 'Worktree review',
      exact: true,
    });
    await expect
      .element(
        panel.getByRole('tab', { name: surface, selected: true, exact: true }),
      )
      .toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect.element(panel).not.toBeInTheDocument();
    await expect
      .element(
        workspace.getByRole('button', { name: new RegExp(`^${surface}`) }),
      )
      .toHaveFocus();
    await expect
      .element(
        workspace.getByRole('heading', {
          name: 'No changes to review',
          exact: true,
        }),
      )
      .toBeVisible();
  });
}

test('Changes lists its files above the diff, marks them reviewed and switches to the branch from the bar at desktop width', async ({
  workspace,
  repo,
  server,
}) => {
  await page.viewport(1440, 900);
  try {
    await expect
      .element(
        workspace.getByRole('complementary', {
          name: 'Review sidebar',
          exact: true,
        }),
      )
      .toBeVisible();
    const tab = workspace.getByRole('tab', { name: 'Changes', exact: true });
    await tab.hover();
    await expect
      .element(
        page
          .getByRole('tooltip')
          .getByText('Changes · 1 uncommitted file', { exact: true }),
      )
      .toBeVisible();
    const table = workspace.getByRole('region', {
      name: '1 uncommitted change',
      exact: true,
    });
    await expect
      .element(table.getByText('0 of 1 file reviewed', { exact: true }))
      .toBeVisible();
    const row = table.getByRole('button', {
      name: `${repo.readme.path} +2 −0`,
      exact: true,
    });
    await expect.element(row).toHaveAttribute('aria-current', 'true');
    const reviewed = table.getByRole('checkbox', {
      name: `${repo.readme.path} reviewed`,
      exact: true,
    });
    await expect.element(reviewed).toHaveAttribute('aria-checked', 'false');
    await reviewed.click();
    await expect.element(reviewed).toHaveAttribute('aria-checked', 'true');
    await expect
      .element(table.getByText('1 of 1 file reviewed', { exact: true }))
      .toBeVisible();
    await expect
      .poll(async () =>
        (await server.reviewedFiles()).marks.map((mark) => mark.path),
      )
      .toEqual([repo.readme.path]);

    await repo.write('notes.md', 'First note\nSecond note\n');
    const both = workspace.getByRole('region', {
      name: '2 uncommitted changes',
      exact: true,
    });
    const notes = both.getByRole('button', {
      name: 'notes.md +2 −0',
      exact: true,
    });
    await notes.click();
    await expect.element(notes).toHaveAttribute('aria-current', 'true');
    await expect
      .element(
        both.getByRole('button', {
          name: `${repo.readme.path} +2 −0`,
          exact: true,
        }),
      )
      .not.toHaveAttribute('aria-current');
    await expect
      .element(workspace.getByText('Second note', { exact: true }))
      .toBeVisible();

    const compare = workspace
      .getByRole('toolbar', { name: 'Document controls', exact: true })
      .getByRole('tablist', { name: 'Compare', exact: true });
    await expect
      .element(compare.getByRole('tab', { name: 'Uncommitted', exact: true }))
      .toHaveAttribute('aria-selected', 'true');
    await compare.getByRole('tab', { name: 'Branch', exact: true }).click();
    await expect.element(both).not.toBeInTheDocument();
    await expect
      .element(compare.getByRole('tab', { name: 'Branch', exact: true }))
      .toHaveAttribute('aria-selected', 'true');
    await compare
      .getByRole('tab', { name: 'Uncommitted', exact: true })
      .click();
    await expect.element(both).toBeVisible();
  } finally {
    await page.viewport(414, 896);
  }
});

test('Changes keeps file shortcuts without redundant header arrows', async ({
  repo,
  render,
  reviewLayout,
}) => {
  await repo.write('zz-notes.md', 'First note\nSecond note\n');
  const workspace = await render.workspace();
  const table = workspace.getByRole('region', {
    name: '2 uncommitted changes',
    exact: true,
  });
  const currentRows = () => reviewLayout.currentChangeRows(table);
  await table
    .getByRole('button', { name: 'zz-notes.md +2 −0', exact: true })
    .click();
  await expect
    .element(
      workspace
        .getByRole('button', { name: 'Previous file', exact: true })
        .first(),
    )
    .not.toBeInTheDocument();
  await expect
    .element(
      workspace.getByRole('button', { name: 'Next file', exact: true }).first(),
    )
    .not.toBeInTheDocument();
  await userEvent.keyboard('K');
  await expect.poll(currentRows).toEqual(['README.md+2−0']);
  await userEvent.keyboard('J');
  await expect.poll(currentRows).toEqual(['zz-notes.md+2−0']);
});

test('Changes reopens a collapsed file from its table', async ({
  workspace,
  repo,
}) => {
  const code = workspace.getByText('A change to review.', { exact: true });
  await expect.element(code).toBeVisible();
  await workspace
    .getByRole('button', { name: `Collapse ${repo.readme.path}`, exact: true })
    .click();
  await expect.element(code).not.toBeInTheDocument();
  await workspace
    .getByRole('region', { name: '1 uncommitted change', exact: true })
    .getByRole('button', { name: `${repo.readme.path} +2 −0`, exact: true })
    .click();
  await expect.element(code).toBeVisible();
});

test('Changes keeps the selected file when an earlier diff finishes loading', async ({
  repo,
  render,
  fetchGate,
  reviewLayout,
}) => {
  await repo.write('zz-notes.md', 'A later file\n');
  const held = fetchGate.holdNextChangeDiff();
  held.arm();
  try {
    const workspace = await render.workspace();
    await held.requested;
    const table = workspace.getByRole('region', {
      name: '2 uncommitted changes',
      exact: true,
    });
    const currentRows = () => reviewLayout.currentChangeRows(table);
    await table
      .getByRole('button', { name: 'zz-notes.md +1 −0', exact: true })
      .click();
    await expect.poll(currentRows).toEqual(['zz-notes.md+1−0']);
    held.release();
    await expect
      .element(workspace.getByText('A change to review.', { exact: true }))
      .toBeInTheDocument();
    await expect.poll(currentRows).toEqual(['zz-notes.md+1−0']);
  } finally {
    held.release();
  }
});
