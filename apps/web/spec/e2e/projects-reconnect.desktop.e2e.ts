import { projectFixture } from '../kit/project-fixture.ts';
import { expect, test } from './fixtures.ts';

test('confirming a replacement opens its new worktree and keeps the original project', async ({
  pairedPage: page,
  server,
  app,
  failures,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const original = await server.project();
  const worktree = original.worktrees[0];
  if (!worktree) throw new Error('The fixture needs its original worktree');
  const fixture = await projectFixture(worktree.path);
  try {
    failures.console(/WorktreeUnavailableError/);
    await fixture.unavailable('replacement');
    await app.reload();
    await expect(
      page.getByText('Worktree unavailable', { exact: true }),
    ).toBeVisible();
    const navigator = page.getByRole('navigation', {
      name: 'Projects and worktrees',
      exact: true,
    });
    await expect(
      navigator.getByText(
        'This folder contains a different repository identity. Reconnect it only if you replaced or restored this repository.',
        { exact: true },
      ),
    ).toBeVisible();
    await navigator
      .getByRole('button', { name: 'Reconnect', exact: true })
      .click();
    const dialog = page.getByRole('dialog', {
      name: `Reconnect ${original.name}`,
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeAttached();
    await expect
      .poll(async () => (await server.project()).available)
      .toBe(false);
    await navigator
      .getByRole('button', { name: 'Reconnect', exact: true })
      .click();
    await dialog
      .getByRole('button', { name: 'Reconnect', exact: true })
      .click();
    await expect(dialog).not.toBeAttached();
    await expect
      .poll(() => server.project())
      .toMatchObject({ id: original.id, available: true });
    await expect
      .poll(async () => (await server.project()).worktrees[0]?.id)
      .not.toBe(worktree.id);
    const rebound = await server.project();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe(`/${original.id}/${rebound.worktrees[0]?.id}`);
    await expect(
      page.getByRole('region', { name: 'Review content', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Worktree not found', { exact: true }),
    ).not.toBeAttached();
  } finally {
    await fixture.restore();
  }
});
