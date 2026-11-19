import { page as browserPage } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('All changes and the Branch document keep the same reading width', async ({
  repo,
  render,
  reviewLayout,
}) => {
  await browserPage.viewport(1600, 900);
  try {
    await repo.branch('feature');
    await repo.switch('feature');
    await repo.write('notes.md', 'Committed branch content.\n');
    await repo.commit('Add branch notes');
    await repo.write('notes.md', 'Uncommitted local content.\n');
    const app = await render.route('/');
    const page = app.page;
    await expect
      .element(page.getByRole('tab', { name: 'Review', exact: true }))
      .toHaveAttribute('aria-selected', 'true');
    const location = app.location().split('?')[0];
    await app.navigate(`${location}?entry=all-changes`);
    const code = (panel: string) =>
      page
        .getByRole('tabpanel', { name: panel, exact: true })
        .getByRole('region', { name: 'Code content', exact: true });
    await expect
      .element(
        code('All changes').getByText('Uncommitted local content.', {
          exact: true,
        }),
      )
      .toBeVisible();
    const uncommitted = reviewLayout.codeContentEdges(code('All changes'));
    await app.navigate(`${location}?entry=branch`);
    const content = code('Branch');
    await expect
      .element(
        page.getByRole('heading', { name: 'feature since main', exact: true }),
      )
      .toBeVisible();
    await expect
      .element(content.getByText('Committed branch content.', { exact: true }))
      .toBeVisible();
    await expect
      .poll(() => {
        const branch = reviewLayout.codeContentEdges(content);
        return Math.max(
          Math.abs(branch.left - uncommitted.left),
          Math.abs(branch.right - uncommitted.right),
        );
      })
      .toBeLessThanOrEqual(1);
  } finally {
    await browserPage.viewport(414, 896);
  }
});

test('a held diff in All changes shows no loading words while it is read', async ({
  repo,
  render,
  fetchGate,
  server,
}) => {
  const project = await server.project();
  const worktree = project.worktrees.find((entry) => entry.main);
  if (!worktree) throw new Error('The fixture has no main worktree.');
  const held = fetchGate.holdNextChangeDiff();
  held.arm();
  try {
    const app = await render.route(
      `/${project.id}/${worktree.id}?entry=all-changes`,
    );
    await held.requested;
    await expect
      .element(app.page.getByText(repo.readme.path, { exact: true }).first())
      .toBeVisible();
    await expect
      .element(app.page.getByText(/Loading|Reading/u))
      .not.toBeInTheDocument();
    held.release();
    await expect
      .element(app.page.getByText('A change to review.', { exact: true }))
      .toBeVisible();
  } finally {
    held.release();
  }
});

test('a failed automatic patch refresh keeps the last patch without an alert', async ({
  repo,
  render,
  fetchGate,
  server,
}) => {
  const project = await server.project();
  const worktree = project.worktrees.find((entry) => entry.main);
  if (!worktree) throw new Error('The fixture has no main worktree.');
  const refusals = fetchGate.failChangeDiffs();
  const app = await render.route(
    `/${project.id}/${worktree.id}?entry=all-changes`,
  );
  await expect
    .element(app.page.getByText('A change to review.', { exact: true }))
    .toBeVisible();
  refusals.start();
  await repo.write(
    repo.readme.path,
    '# Sample repository\n\nA rewrite.\n\nWith a second line.\n',
  );
  await expect
    .poll(() => refusals.refused(), { timeout: 10_000 })
    .toBeGreaterThan(0);
  await expect
    .element(app.page.getByText('A change to review.', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      app.page.getByText('The changes in this document could not be read.', {
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
});

test('a file that appears during a refused refresh raises no alert', async ({
  repo,
  render,
  fetchGate,
  server,
}) => {
  await repo.write(repo.readme.path, repo.readme.committed);
  await repo.write('notes.txt', 'First notes\n');
  await repo.commit('Add notes');
  await repo.write(repo.readme.path, repo.readme.changed);
  const project = await server.project();
  const worktree = project.worktrees.find((entry) => entry.main);
  if (!worktree) throw new Error('The fixture has no main worktree.');
  const refusals = fetchGate.failChangeDiffs();
  const app = await render.route(
    `/${project.id}/${worktree.id}?entry=all-changes`,
  );
  await expect
    .element(app.page.getByText('A change to review.', { exact: true }))
    .toBeVisible();
  refusals.start();
  await repo.write('notes.txt', 'First notes\nLater notes\n');
  await expect
    .element(app.page.getByText('notes.txt', { exact: true }).first())
    .toBeVisible();
  await expect
    .poll(() => refusals.refused(), { timeout: 10_000 })
    .toBeGreaterThan(0);
  await expect
    .element(app.page.getByRole('button', { name: 'Try again', exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(app.page.getByText('A change to review.', { exact: true }))
    .toBeVisible();
});

test('a refused first diff read keeps Try again while an untracked file shows', async ({
  repo,
  render,
  fetchGate,
  server,
}) => {
  await repo.write('loose.txt', 'A loose note\n');
  const project = await server.project();
  const worktree = project.worktrees.find((entry) => entry.main);
  if (!worktree) throw new Error('The fixture has no main worktree.');
  const refusals = fetchGate.failChangeDiffs();
  refusals.start();
  const app = await render.route(
    `/${project.id}/${worktree.id}?entry=all-changes`,
  );
  await expect
    .element(app.page.getByText('A loose note', { exact: true }))
    .toBeVisible();
  await expect
    .element(app.page.getByRole('button', { name: 'Try again', exact: true }))
    .toBeVisible();
});
