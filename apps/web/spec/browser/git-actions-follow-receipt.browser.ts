import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';
import { live } from '../kit/live';

test('a commit made while the live connection is down shows its outcome once the app reconnects and reads the receipt', async ({
  pairedPage,
  server,
}) => {
  const message = 'Followed commit';
  await pairedPage.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = pairedPage.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Message' }).fill(message);
  live.drop();
  await expect.poll(() => live.connected()).toBe(false);
  await dialog.getByRole('button', { name: 'Commit selected files' }).click();
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(message);
  await expect
    .element(dialog.getByRole('button', { name: 'Committing…' }))
    .toBeDisabled();

  live.restore();
  await expect.poll(() => live.connected()).toBe(true);
  await expect.element(dialog.getByText('succeeded')).toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect.element(dialog).not.toBeInTheDocument();
});

test('a stash pop refused while the live connection is down shows what Git said once the app reconnects and reads the receipt', async ({
  pairedPage,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const local = 'Changed while the stash was set aside\n';
  await repo.write(readme, 'Set aside\n');
  await expect
    .element(
      pairedPage.getByRole('button', { name: `Mark ${readme} as reviewed` }),
    )
    .toBeVisible();
  await pairedPage.getByRole('button', { name: 'Git actions' }).click();
  await pairedPage.getByRole('menuitem', { name: /^Stash changes/ }).click();
  const stash = pairedPage.getByRole('dialog', { name: 'Stash changes' });
  await stash.getByRole('button', { name: 'Stash changes' }).click();
  await expect.element(stash.getByText('succeeded')).toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect.element(stash).not.toBeInTheDocument();

  await repo.write(readme, local);
  await expect
    .element(
      pairedPage.getByRole('button', { name: `Mark ${readme} as reviewed` }),
    )
    .toBeVisible();
  await pairedPage.getByRole('button', { name: 'Git actions' }).click();
  await pairedPage.getByRole('menuitem', { name: /^Pop stash/ }).click();
  const pop = pairedPage.getByRole('dialog', { name: 'Pop stash' });
  live.drop();
  await expect.poll(() => live.connected()).toBe(false);
  await pop.getByRole('button', { name: 'Pop stash' }).click();
  await expect
    .element(pop.getByRole('button', { name: 'Working…' }))
    .toBeDisabled();

  live.restore();
  await expect
    .element(pop.getByRole('alert'))
    .toMatchTextContent(/would be overwritten/);
  await expect.poll(async () => (await server.text(readme)).text).toBe(local);
});
