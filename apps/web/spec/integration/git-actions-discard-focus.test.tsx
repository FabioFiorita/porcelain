import { page, userEvent } from 'vite-plus/test/browser';
import { expect, test } from './fixtures.tsx';

test('Escape on a discard confirmation opened while its diff loads returns to the Discard button', async ({
  render,
  fetchGate,
  repo,
  server,
}) => {
  await page.viewport(1280, 896);
  try {
    const changed = 'A change to discard.';
    await repo.write(repo.readme.path, `# Sample repository\n\n${changed}\n`);
    const project = await server.project();
    const worktree = project.worktrees.find((entry) => entry.main);
    if (!worktree) throw new Error('The fixture has no main worktree.');
    const held = fetchGate.holdNextChangeDiff();
    held.arm();
    const opened = (
      await render.route(
        `/${project.id}/${worktree.id}?entry=change:${repo.readme.path}`,
      )
    ).page;
    await held.requested;
    const discard = opened.getByRole('button', {
      name: `Discard changes to ${repo.readme.path}`,
      exact: true,
    });
    await discard.click();
    const confirmation = opened.getByRole('alertdialog');
    await expect.element(confirmation).toBeVisible();
    held.release();
    await expect
      .element(opened.getByText(changed, { exact: true }))
      .toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await expect.element(confirmation).not.toBeInTheDocument();
    await expect.element(discard).toHaveFocus();
  } finally {
    await page.viewport(414, 896);
  }
});
