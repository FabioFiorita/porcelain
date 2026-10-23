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
      .element(panel().getByRole('heading', { level: 2 }))
      .toHaveTextContent('Files');
    await expect
      .element(workspace.getByRole('button', { name: 'Review', exact: true }))
      .not.toBeVisible();

    for (const view of ['Changes', 'History', 'Files']) {
      await rail().getByRole('button', { name: view, exact: true }).click();
      await expect
        .element(panel().getByRole('heading', { level: 2 }))
        .toHaveTextContent(view);
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
      .element(panel().getByRole('heading', { level: 2 }))
      .toHaveTextContent('Files');
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
        .element(panel().getByRole('heading', { level: 2 }))
        .toHaveTextContent(view);
      await expect
        .element(rail().getByRole('button', { name: view, exact: true }))
        .toHaveAttribute('aria-pressed', 'true');
    }

    await userEvent.keyboard('{Alt>}{Shift>}R{/Shift}{/Alt}');
    await expect.element(panel()).not.toBeInTheDocument();
    await userEvent.keyboard('{Alt>}{Shift>}R{/Shift}{/Alt}');
    await expect
      .element(panel().getByRole('heading', { level: 2 }))
      .toHaveTextContent('Files');
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

test('the History panel names the branch, counts uncommitted files and opens them', async ({
  workspace,
  repo,
}) => {
  await page.viewport(1280, 896);
  try {
    await repo.write('notes.md', 'Uncommitted notes\n');
    await rail().getByRole('button', { name: 'History', exact: true }).click();
    const branch = panel().getByRole('region', { name: 'Branch', exact: true });
    await expect
      .element(branch.getByText(repo.initialBranch, { exact: true }))
      .toBeVisible();
    await expect
      .element(branch.getByText('No upstream', { exact: true }))
      .toBeVisible();
    const uncommitted = panel().getByRole('button', {
      name: 'Uncommitted changes 1 file',
      exact: true,
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
