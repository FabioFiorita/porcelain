import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('a commit that Git never finishes ends interrupted, and its notice stays until Got it dismisses it', async ({
  workspace,
  repo,
  server,
}) => {
  await repo.remove('.git/logs/HEAD');
  await repo.fifo('.git/logs/HEAD');
  await workspace.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = workspace.getByRole('dialog');
  await dialog
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Stuck commit');
  await dialog
    .getByRole('button', { name: 'Commit selected files', exact: true })
    .click();
  await expect
    .element(dialog.getByRole('alert'))
    .toHaveTextContent('outcome unknown');
  await userEvent.keyboard('{Escape}');
  await expect.element(dialog).not.toBeInTheDocument();

  const notice = workspace
    .getByRole('status')
    .filter({ hasText: 'A Git action was interrupted: commit' });
  await expect.element(notice).toBeVisible();
  await expect
    .element(
      notice.getByText('Check the current changes before trying again.', {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .poll(async () => (await server.changes()).interrupted?.action)
    .toBe('commit');
  const requestId = (await server.changes()).interrupted?.requestId ?? '';

  await notice.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect.element(notice).not.toBeInTheDocument();
  await expect
    .poll(async () => (await server.changes()).interrupted)
    .toBeUndefined();
  await expect
    .poll(async () => (await server.receipt(requestId)).state)
    .toBe('interrupted');
});
