import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('pushing to a remote whose address Porcelain cannot use is refused in the Git button box, which keeps the reason until closed, and the branch gains no upstream', async ({
  workspace,
  repo,
  server,
}) => {
  const branch = (await server.gitStatus()).branch?.name;
  await repo.remote('origin', 'git://127.0.0.1:9/remote.git');
  await workspace
    .getByRole('button', { name: 'Git actions', exact: true })
    .click();
  const push = workspace.getByRole('menuitem', { name: /^Push/ });
  await expect.element(push).toBeEnabled();
  await expect
    .element(workspace.getByRole('menuitem', { name: /^Pull/ }))
    .toHaveAttribute('aria-disabled', 'true');
  await push.click();
  const box = workspace.getByRole('dialog', {
    name: 'Push did not run',
    exact: true,
  });
  await expect.element(box).toBeVisible();
  await expect
    .element(
      box.getByText(
        /The remote URL is not one Porcelain can use\. It supports a local path, SSH, and HTTPS/,
      ),
    )
    .toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect.element(box).not.toBeInTheDocument();
  await expect
    .poll(async () => (await server.gitStatus()).branch)
    .toEqual({ name: branch, ahead: 0, behind: 0, stashes: [], discarded: [] });
});
