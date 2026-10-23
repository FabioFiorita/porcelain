import { page, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('Changes and Review remain the first tab and cannot close by keyboard or menu', async ({
  workspace,
  agent,
}) => {
  const tabs = workspace.getByRole('tablist', {
    name: 'Open documents',
    exact: true,
  });
  await expect
    .element(tabs.getByRole('tab', { name: 'Changes', exact: true }))
    .toBeVisible();
  await tabs.getByRole('tab', { name: 'Changes', exact: true }).click();
  await userEvent.keyboard('{Alt>}w{/Alt}');
  await expect
    .element(tabs.getByRole('tab', { name: 'Changes', exact: true }))
    .toBeVisible();
  await expect
    .element(
      workspace.getByRole('button', { name: 'Close Changes', exact: true }),
    )
    .not.toBeInTheDocument();
  await tabs
    .getByRole('tab', { name: 'Changes', exact: true })
    .click({ button: 'right' });
  await expect
    .element(workspace.getByRole('menuitem', { name: /^Close Alt/ }))
    .toBeDisabled();
  await userEvent.keyboard('{Escape}');
  await agent.publishReview('Readme layer');
  await tabs.getByRole('tab', { name: 'Review', exact: true }).click();
  await userEvent.keyboard('{Alt>}w{/Alt}');
  await expect
    .element(tabs.getByRole('tab', { name: 'Review', exact: true }))
    .toBeVisible();
  await expect
    .element(
      workspace.getByRole('button', { name: 'Close Review', exact: true }),
    )
    .not.toBeInTheDocument();
});

test('the active file chip stays inside the narrow tab strip after its controls arrive', async ({
  render,
  repo,
  reviewLayout,
}) => {
  await page.viewport(414, 896);
  const workspace = await render.workspace();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('treeitem', { name: repo.readme.path, exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  const controls = workspace.getByRole('toolbar', {
    name: 'Document controls',
    exact: true,
  });
  await expect
    .element(controls.getByRole('button', { name: 'Timeline', exact: true }))
    .toBeVisible();
  const selected = workspace
    .getByRole('tablist', { name: 'Open documents', exact: true })
    .getByRole('tab', { name: repo.readme.path, exact: true });
  await expect.poll(() => reviewLayout.tabInsideStrip(selected)).toBe(true);
});

test('a split has controls in each pane, one Git button, and closes with its last side tab', async ({
  workspace,
  repo,
}) => {
  const path = repo.readme.path;
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('treeitem', { name: path, exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await userEvent.keyboard('{Alt>}\\{/Alt}');
  const left = workspace.getByRole('region', {
    name: 'Left pane',
    exact: true,
  });
  const right = workspace.getByRole('region', {
    name: 'Right pane',
    exact: true,
  });
  for (const pane of [left, right]) {
    const controls = pane.getByRole('toolbar', {
      name: 'Document controls',
      exact: true,
    });
    await expect
      .element(controls.getByRole('button', { name: 'Comment', exact: true }))
      .toBeVisible();
    await expect
      .element(controls.getByRole('button', { name: 'Timeline', exact: true }))
      .toBeVisible();
  }
  await expect
    .element(left.getByRole('button', { name: 'Git actions', exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(right.getByRole('button', { name: 'Git actions', exact: true }))
    .toBeVisible();
  await userEvent.keyboard('{Alt>}w{/Alt}');
  await expect.element(right).not.toBeInTheDocument();
  await expect
    .element(
      workspace.getByRole('tablist', { name: 'Open documents', exact: true }),
    )
    .toBeVisible();
});

test.for(
  [
    { width: 414, path: 'README.md' },
    { width: 1440, path: 'README.md' },
    {
      width: 414,
      path: 'a-very-long-document-name-that-is-truncated-in-the-tab.md',
    },
    {
      width: 1440,
      path: 'a-very-long-document-name-that-is-truncated-in-the-tab.md',
    },
  ].flatMap((document) => [
    { ...document, pinned: false },
    { ...document, pinned: true },
  ]),
)(
  'tab action tooltips name their action and the chip keeps its document hint at $width: $path, pinned=$pinned',
  async ({ width, path, pinned }, { render, repo }) => {
    await page.viewport(width, 896);
    try {
      await repo.write(path, '# Document\n');
      const app = await render.route('/');
      const tabs = app.page.getByRole('tablist', {
        name: 'Open documents',
        exact: true,
      });
      await expect
        .element(tabs.getByRole('tab', { name: 'Changes', exact: true }))
        .toBeVisible();
      await app.navigate(`${app.location().split('?')[0]}?entry=file:${path}`);
      const tab = app.page
        .getByRole('tablist', { name: 'Open documents', exact: true })
        .getByRole('tab', { name: path, exact: true });
      const name = path.slice(path.lastIndexOf('/') + 1);
      const close = tab.getByRole('button', {
        name: `Close ${name}`,
        exact: true,
      });
      await expect
        .element(
          app.page
            .getByRole('toolbar', { name: 'Document controls', exact: true })
            .getByRole('button', { name: 'Timeline', exact: true }),
        )
        .toBeVisible();
      const tooltip = app.page.getByText(/ · file|^Close |^Unpin /);
      if (!pinned) {
        await userEvent.hover(close);
        await expect.element(tooltip).toHaveTextContent(`Close ${name}Alt+W`);
        await tab.hover({ position: { x: 8, y: 14 } });
        await expect.element(tooltip).toHaveTextContent(`${path} · file`);
        await close.click();
        await expect.element(tab).not.toBeInTheDocument();
        return;
      }
      await tab.click({ button: 'right' });
      await app.page
        .getByRole('menuitem', { name: 'Pin', exact: true })
        .click();
      await expect.element(app.page.getByRole('menu')).not.toBeInTheDocument();
      await userEvent.hover(
        app.page.getByRole('heading', { name: 'Document', exact: true }),
      );
      const unpin = tab.getByRole('button', {
        name: `Unpin ${name}`,
        exact: true,
      });
      await userEvent.hover(unpin);
      await expect.element(tooltip).toHaveTextContent(`Unpin ${name}`);
      await tab.hover({ position: { x: 8, y: 14 } });
      await expect
        .element(tooltip)
        .toHaveTextContent(`${path} · file · pinned`);
      await userEvent.hover(close);
      await expect.element(tooltip).toHaveTextContent(`Close ${name}Alt+W`);
      await tabs.getByRole('tab', { name: 'Changes', exact: true }).click();
      await expect.element(close).not.toBeInTheDocument();
      await userEvent.hover(unpin);
      await expect.element(tooltip).toHaveTextContent(`Unpin ${name}`);
      await unpin.click();
      await expect.element(unpin).not.toBeInTheDocument();
      await expect.element(tab).toHaveAttribute('aria-selected', 'false');
      await tab.click();
      await close.click();
      await expect.element(tab).not.toBeInTheDocument();
    } finally {
      await page.viewport(414, 896);
    }
  },
);
