import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

const stuck = 'journey-stuck';

test('a branch creation that Git never finishes ends interrupted, and its notice stays until Got it dismisses it', async ({
  pairedPage,
  repo,
  server,
}) => {
  await repo.fifo(`.git/logs/refs/heads/${stuck}`);
  await pairedPage.getByRole('button', { name: 'Git actions' }).click();
  await pairedPage.getByRole('menuitem', { name: /^Create branch/ }).click();
  const dialog = pairedPage.getByRole('dialog', { name: 'Create branch' });
  await dialog.getByRole('textbox', { name: 'Branch name' }).fill(stuck);
  await dialog.getByRole('button', { name: 'Create branch' }).click();
  await expect
    .element(dialog.getByRole('alert'))
    .toHaveTextContent('outcome unknown');
  await userEvent.keyboard('{Escape}');
  await expect.element(dialog).not.toBeInTheDocument();

  const notice = pairedPage
    .getByRole('status')
    .filter({ hasText: 'A Git action was interrupted: create branch' });
  await expect.element(notice).toBeVisible();
  await expect
    .element(notice.getByText('Check the current changes before trying again.'))
    .toBeVisible();
  await expect
    .poll(async () => (await server.changes()).interrupted?.action)
    .toBe('create-branch');
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
