import { userEvent } from 'vite-plus/test/browser';
import { expect, test } from './fixtures.tsx';

test('reopening configured preferences retains values without checking update permissions again', async ({
  render,
  server,
  fetchGate,
}) => {
  const held = fetchGate.holdNextReviewGitSettings();
  const page = await render.preferences();
  await page
    .getByRole('button', {
      name: 'Use these settings for this computer',
      exact: true,
    })
    .click();
  const specs = page.getByRole('switch', { name: 'Spec files', exact: true });
  await expect.element(specs).toBeEnabled();
  await page.getByRole('tab', { name: 'Rebase', exact: true }).click();
  await expect
    .poll(() => server.reviewGitSettings())
    .toMatchObject({
      kind: 'configured',
      settings: { pullStrategy: 'rebase' },
    });
  await page
    .getByRole('button', { name: 'Hide preferences', exact: true })
    .click();
  await expect.element(specs).not.toBeInTheDocument();
  const checks = await server.serviceUpdateReads();
  held.arm();
  try {
    await page
      .getByRole('button', { name: 'Show preferences', exact: true })
      .click();
    await held.requested;
    await expect
      .element(page.getByRole('tab', { name: 'Rebase', exact: true }))
      .toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => server.serviceUpdateReads()).toBe(checks);
    held.release();
    await held.finished;
    await expect.element(specs).toBeEnabled();
    await expect.poll(() => server.serviceUpdateReads()).toBe(checks);
  } finally {
    held.release();
  }
});

test('fresh archive preferences keep remote branches and require explicit initialization', async ({
  render,
  server,
}) => {
  const page = await render.preferences();
  const remote = page.getByRole('switch', {
    name: 'Delete remote branch',
    exact: true,
  });
  const worktree = page.getByRole('switch', {
    name: 'Delete local worktree',
    exact: true,
  });
  const merge = page.getByRole('tab', { name: 'Merge', exact: true });
  await expect.element(remote).toBeDisabled();
  await expect.element(remote).not.toBeChecked();
  await expect.element(worktree).toBeDisabled();
  await expect.element(worktree).toBeChecked();
  await expect.element(merge).toBeDisabled();
  await expect.element(merge).toHaveAttribute('aria-selected', 'true');
  await expect
    .element(
      page.getByText(
        /These preview values come from this device’s preferences or the defaults\./,
      ),
    )
    .toBeVisible();
  await expect
    .element(
      page.getByRole('link', { name: 'Review archive deletions', exact: true }),
    )
    .toHaveAttribute('href', '/settings/git#archive-settings');
  const archive = page.getByRole('group', {
    name: 'When archiving',
    exact: true,
  });
  await expect.element(archive).toHaveAttribute('id', 'archive-settings');
  await expect.element(archive.getByText('Off', { exact: true })).toBeVisible();
  await expect
    .element(
      archive.getByText(
        'Archive asks you to confirm these deletions before running them.',
        { exact: true },
      ),
    )
    .toBeVisible();
  await page
    .getByRole('button', {
      name: 'Use these settings for this computer',
      exact: true,
    })
    .click();
  await expect.element(remote).toBeEnabled();
  await expect.element(remote).not.toBeChecked();
  await expect
    .poll(() => server.reviewGitSettings())
    .toMatchObject({
      kind: 'configured',
      settings: {
        archiveDeleteRemoteBranch: false,
        archiveDeleteWorktree: true,
        pullStrategy: 'merge',
      },
    });
});

test('global Settings titles name Porcelain across sections and restore the workspace title', async ({
  render,
}) => {
  const app = await render.route('/settings/general');
  await expect.poll(() => app.title()).toBe('Settings — Porcelain');
  for (const path of [
    '/settings/git',
    '/settings/computers',
    '/settings/computers/this-computer',
  ]) {
    await app.navigate(path);
    await expect.poll(() => app.title()).toBe('Settings — Porcelain');
  }
  await app.navigate('/settings/computers');
  await expect
    .element(
      app.page.getByRole('heading', {
        name: 'Settings. Computers',
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      app.page.getByText('Manage your paired computers.', { exact: true }),
    )
    .not.toBeInTheDocument();
  await app.navigate('/');
  await expect.poll(() => app.title()).toMatch(/^Review — /);
});

test('arrow keys move between tabs without choosing, and Enter chooses', async ({
  render,
  server,
}) => {
  const page = await render.preferences();
  await page
    .getByRole('button', {
      name: 'Use these settings for this computer',
      exact: true,
    })
    .click();
  const merge = page.getByRole('tab', { name: 'Merge', exact: true });
  const rebase = page.getByRole('tab', { name: 'Rebase', exact: true });
  await expect.element(merge).toBeEnabled();
  await merge.click();
  await expect.element(merge).toHaveFocus();
  await userEvent.keyboard('{ArrowRight}');
  await expect.element(rebase).toHaveFocus();
  await expect.element(rebase).toHaveAttribute('aria-selected', 'false');
  await expect.element(merge).toHaveAttribute('aria-selected', 'true');
  await userEvent.keyboard('{Enter}');
  await expect.element(rebase).toHaveAttribute('aria-selected', 'true');
  await expect
    .poll(() => server.reviewGitSettings())
    .toMatchObject({
      kind: 'configured',
      settings: { pullStrategy: 'rebase' },
    });
});
