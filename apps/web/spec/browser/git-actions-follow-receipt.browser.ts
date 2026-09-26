import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';
import { live } from '../kit/live';

const followed = 'journey-followed';

test('a branch created while the live connection is down shows its outcome once the app reconnects and reads the receipt', async ({
  pairedPage,
  server,
}) => {
  await pairedPage.getByRole('button', { name: 'Git actions' }).click();
  await pairedPage.getByRole('menuitem', { name: /^Create branch/ }).click();
  const dialog = pairedPage.getByRole('dialog', { name: 'Create branch' });
  await dialog.getByRole('textbox', { name: 'Branch name' }).fill(followed);
  live.drop();
  await expect.poll(() => live.connected()).toBe(false);
  await dialog.getByRole('button', { name: 'Create branch' }).click();
  await expect
    .poll(async () => (await server.branches()).current)
    .toBe(followed);
  await expect
    .element(dialog.getByRole('button', { name: 'Checking…' }))
    .toBeDisabled();

  live.restore();
  await expect.poll(() => live.connected()).toBe(true);
  await expect.element(dialog).not.toBeInTheDocument();
  await pairedPage.getByRole('button', { name: 'Git actions' }).click();
  await expect
    .element(pairedPage.getByRole('menu').getByText(followed, { exact: true }))
    .toBeVisible();
  await userEvent.keyboard('{Escape}');
});

test('a branch refused while the live connection is down shows what Git said once the app reconnects and reads the receipt', async ({
  pairedPage,
  server,
}) => {
  await pairedPage.getByRole('button', { name: 'Git actions' }).click();
  await pairedPage.getByRole('menuitem', { name: /^Create branch/ }).click();
  const dialog = pairedPage.getByRole('dialog', { name: 'Create branch' });
  await dialog.getByRole('textbox', { name: 'Branch name' }).fill(followed);
  live.drop();
  await expect.poll(() => live.connected()).toBe(false);
  await dialog.getByRole('button', { name: 'Create branch' }).click();
  await expect
    .element(dialog.getByRole('button', { name: 'Checking…' }))
    .toBeDisabled();

  live.restore();
  await expect
    .element(dialog.getByRole('alert'))
    .toHaveTextContent(`fatal: a branch named '${followed}' already exists`);
  await expect
    .poll(async () =>
      (await server.branches()).branches.filter(
        (branch) => branch.name === followed,
      ),
    )
    .toHaveLength(1);
});
