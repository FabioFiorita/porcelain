import { expect } from 'vitest';
import { test } from '../kit/journey';

test('pushing to a remote whose address Porcelain cannot use is refused with how to fix it, and the branch gains no upstream', async ({
  pairedPage,
  repo,
  server,
}) => {
  const branch = (await server.branches()).current;
  await repo.remote('origin', 'git://127.0.0.1:9/remote.git');
  await pairedPage.getByRole('button', { name: 'Git actions' }).click();
  const push = pairedPage.getByRole('menuitem', { name: /^Push/ });
  await expect.element(push).toBeEnabled();
  await expect
    .element(pairedPage.getByRole('menuitem', { name: /^Pull/ }))
    .toHaveAttribute('aria-disabled', 'true');
  await push.click();
  await expect
    .element(pairedPage.getByText('Push did not run', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      pairedPage.getByText(
        /The remote URL is not one Porcelain can use\. It supports a local path, SSH, and HTTPS/,
      ),
    )
    .toBeVisible();
  await expect
    .poll(async () => (await server.gitStatus()).branch)
    .toEqual({ name: branch, ahead: 0, behind: 0, stashes: [], discarded: [] });
});
