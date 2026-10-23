import { page, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

const rail = () =>
  page.getByRole('navigation', { name: 'Side panel', exact: true });
const panel = () =>
  page.getByRole('complementary', { name: 'Review sidebar', exact: true });

test('the rail opens each view in the docked panel and the open view or the hide button closes it', async ({
  workspace,
}) => {
  await page.viewport(1280, 896);
  try {
    await expect
      .element(rail().getByRole('button', { name: 'Files', exact: true }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect
      .element(
        panel().getByRole('heading', { level: 2, name: 'Files', exact: true }),
      )
      .toBeVisible();
    await expect
      .element(workspace.getByRole('button', { name: 'Review', exact: true }))
      .not.toBeInTheDocument();

    for (const view of ['Changes', 'History', 'Files']) {
      await rail().getByRole('button', { name: view, exact: true }).click();
      await expect
        .element(
          panel().getByRole('heading', { level: 2, name: view, exact: true }),
        )
        .toBeVisible();
    }

    await rail().getByRole('button', { name: 'Files', exact: true }).click();
    await expect.element(panel()).not.toBeInTheDocument();
    for (const view of ['Files', 'Changes', 'History'])
      await expect
        .element(rail().getByRole('button', { name: view, exact: true }))
        .toHaveAttribute('aria-pressed', 'false');
    const show = workspace.getByRole('button', {
      name: 'Show side panel',
      exact: true,
    });
    await expect.element(show).toHaveAttribute('aria-expanded', 'false');

    await show.click();
    await expect
      .element(
        panel().getByRole('heading', { level: 2, name: 'Files', exact: true }),
      )
      .toBeVisible();
    await workspace
      .getByRole('button', { name: 'Hide side panel', exact: true })
      .click();
    await expect.element(panel()).not.toBeInTheDocument();
  } finally {
    await page.viewport(414, 896);
  }
});

test('Alt+1, Alt+2 and Alt+3 open their view and Alt+Shift+R hides and shows the panel', async ({
  workspace,
}) => {
  await page.viewport(1280, 896);
  try {
    await expect.element(panel()).toBeVisible();
    await userEvent.keyboard('{Alt>}{Shift>}R{/Shift}{/Alt}');
    await expect.element(panel()).not.toBeInTheDocument();
    await expect
      .element(
        workspace.getByRole('button', { name: 'Show side panel', exact: true }),
      )
      .toHaveFocus();

    for (const [key, view] of [
      ['3', 'History'],
      ['2', 'Changes'],
      ['1', 'Files'],
    ] as const) {
      await userEvent.keyboard(`{Alt>}${key}{/Alt}`);
      await expect
        .element(
          panel().getByRole('heading', { level: 2, name: view, exact: true }),
        )
        .toBeVisible();
      await expect
        .element(rail().getByRole('button', { name: view, exact: true }))
        .toHaveAttribute('aria-pressed', 'true');
    }

    await userEvent.keyboard('{Alt>}{Shift>}R{/Shift}{/Alt}');
    await expect.element(panel()).not.toBeInTheDocument();
    await userEvent.keyboard('{Alt>}{Shift>}R{/Shift}{/Alt}');
    await expect
      .element(
        panel().getByRole('heading', { level: 2, name: 'Files', exact: true }),
      )
      .toBeVisible();
  } finally {
    await page.viewport(414, 896);
  }
});

test('Alt+3 opens the review sheet on History at phone width', async ({
  workspace,
}) => {
  await userEvent.keyboard('{Alt>}3{/Alt}');
  const sheet = workspace.getByRole('dialog', {
    name: 'Worktree review',
    exact: true,
  });
  await expect
    .element(sheet.getByRole('tab', { name: 'History', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect.element(rail()).not.toBeInTheDocument();
});

test('widening past 1280px with the review sheet open closes the sheet and docks the panel', async ({
  workspace,
}) => {
  await userEvent.keyboard('{Alt>}1{/Alt}');
  const sheet = workspace.getByRole('dialog', {
    name: 'Worktree review',
    exact: true,
  });
  await expect.element(sheet).toBeVisible();
  await page.viewport(1280, 896);
  try {
    await expect.element(sheet).not.toBeInTheDocument();
    await expect
      .element(
        panel().getByRole('heading', { level: 2, name: 'Files', exact: true }),
      )
      .toBeVisible();
  } finally {
    await page.viewport(414, 896);
  }
});

test('the History panel names the branch, counts uncommitted files as they change and opens them', async ({
  workspace,
  repo,
}) => {
  await page.viewport(1280, 896);
  try {
    await rail().getByRole('button', { name: 'History', exact: true }).click();
    const branch = panel().getByRole('region', { name: 'Branch', exact: true });
    await expect
      .element(branch.getByText(repo.initialBranch, { exact: true }))
      .toBeVisible();
    await expect
      .element(branch.getByText('No upstream', { exact: true }))
      .toBeVisible();
    await expect
      .element(
        panel().getByRole('button', {
          name: /^Uncommitted changes\s*1 file$/u,
        }),
      )
      .toBeVisible();
    await repo.write('notes.md', 'Uncommitted notes\n');
    const uncommitted = panel().getByRole('button', {
      name: /^Uncommitted changes\s*2 files$/u,
    });
    await uncommitted.click();
    await expect
      .element(
        workspace
          .getByRole('tablist', { name: 'Open documents', exact: true })
          .getByRole('tab', { name: 'All changes', exact: true }),
      )
      .toHaveAttribute('aria-selected', 'true');
  } finally {
    await page.viewport(414, 896);
  }
});

test('the Pinned group shows its count and folds away', async ({
  workspace,
  repo,
}) => {
  await repo.write('guide.md', '# Guide\n');
  await page.viewport(1280, 896);
  try {
    await workspace
      .getByRole('treeitem', { name: 'guide.md', exact: true })
      .click({ button: 'right' });
    await workspace
      .getByRole('menuitem', { name: 'Pin file', exact: true })
      .click();
    const group = workspace.getByRole('region', {
      name: 'Pinned files',
      exact: true,
    });
    const header = group.getByRole('button', {
      name: 'Pinned 1',
      exact: true,
    });
    await expect.element(header).toHaveAttribute('aria-expanded', 'true');
    await expect
      .element(
        group.getByRole('button', { name: 'Unpin guide.md', exact: true }),
      )
      .toBeVisible();
    await header.click();
    await expect.element(header).toHaveAttribute('aria-expanded', 'false');
    await expect
      .element(
        group.getByRole('button', { name: 'Unpin guide.md', exact: true }),
      )
      .not.toBeInTheDocument();
  } finally {
    await page.viewport(414, 896);
  }
});

test('the Graph tab gives each commit one row with its id, HEAD badge and age at desktop width', async ({
  workspace,
}) => {
  await page.viewport(1280, 896);
  try {
    await rail().getByRole('button', { name: 'History', exact: true }).click();
    await panel()
      .getByRole('button', { name: 'Open graph', exact: true })
      .click();
    const graph = workspace.getByRole('list', {
      name: 'Commit graph',
      exact: true,
    });
    const row = graph.getByRole('listitem').first();
    await expect
      .element(
        row.getByRole('button', { name: /^Initial commit [0-9a-f]{7} / }),
      )
      .toBeVisible();
    await expect.element(row.getByText('HEAD', { exact: true })).toBeVisible();
  } finally {
    await page.viewport(414, 896);
  }
});

test('the History branch row keeps a long branch name on one line and gives its full name on focus', async ({
  workspace,
  repo,
  refChips,
}) => {
  const name =
    'experiment/an-extremely-long-branch-name-that-cannot-fit-the-side-panel';
  await repo.branch(name);
  await repo.switch(name);
  await page.viewport(1280, 896);
  try {
    await rail().getByRole('button', { name: 'History', exact: true }).click();
    const branch = workspace
      .getByRole('region', { name: 'Branch', exact: true })
      .getByText(name, { exact: true });
    await expect.element(branch).toBeVisible();
    await expect.element(branch).toHaveStyle('text-overflow: ellipsis');
    await branch.click();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await userEvent.keyboard('{Tab}');
    await expect.element(branch).toHaveFocus();
    await expect.poll(() => refChips.tooltipName()).toBe(name);
  } finally {
    await page.viewport(414, 896);
  }
});
