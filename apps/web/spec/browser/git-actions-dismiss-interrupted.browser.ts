import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

test('a commit that Git never finishes ends interrupted, and its notice stays until Got it dismisses it', async ({
  pairedPage,
  repo,
  server,
}) => {
  await repo.remove('.git/logs/HEAD');
  await repo.fifo('.git/logs/HEAD');
  await pairedPage.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = pairedPage.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Message' }).fill('Stuck commit');
  await dialog.getByRole('button', { name: 'Commit selected files' }).click();
  await expect
    .element(dialog.getByRole('alert'))
    .toHaveTextContent('outcome unknown');
  await userEvent.keyboard('{Escape}');
  await expect.element(dialog).not.toBeInTheDocument();

  const notice = pairedPage
    .getByRole('status')
    .filter({ hasText: 'A Git action was interrupted: commit' });
  await expect.element(notice).toBeVisible();
  await expect
    .element(notice.getByText('Check the current changes before trying again.'))
    .toBeVisible();
  await expect
    .poll(async () => (await server.changes()).interrupted?.action)
    .toBe('commit');
  const requestId = (await server.changes()).interrupted?.requestId ?? '';

  await notice.getByRole('button', { name: 'Got it' }).click();
  await expect.element(notice).not.toBeInTheDocument();
  await expect
    .poll(async () => (await server.changes()).interrupted)
    .toBeUndefined();
  await expect
    .poll(async () => (await server.receipt(requestId)).state)
    .toBe('interrupted');
});
