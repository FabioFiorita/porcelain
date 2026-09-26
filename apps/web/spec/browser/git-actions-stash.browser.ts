import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

test('stashing sets the changes aside and popping the stash brings them back', async ({
  pairedPage,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const stashes = async () =>
    ((await server.gitStatus()).branch?.stashes ?? []).map(
      (entry) => entry.message,
    );
  await pairedPage.getByRole('button', { name: 'Git actions' }).click();
  await pairedPage.getByRole('menuitem', { name: /^Stash changes/ }).click();
  const stash = pairedPage.getByRole('dialog', { name: 'Stash changes' });
  await stash.getByRole('textbox', { name: 'Message' }).fill('Journey stash');
  await stash.getByRole('button', { name: 'Stash changes' }).click();
  await expect.element(stash.getByText('succeeded')).toBeVisible();
  await expect.poll(async () => (await server.changes()).changes).toEqual([]);
  await expect
    .poll(stashes)
    .toEqual([`On ${(await server.branches()).current}: Journey stash`]);
  await userEvent.keyboard('{Escape}');
  await expect.element(stash).not.toBeInTheDocument();

  await pairedPage.getByRole('button', { name: 'Git actions' }).click();
  await pairedPage.getByRole('menuitem', { name: /^Pop stash/ }).click();
  const pop = pairedPage.getByRole('dialog', { name: 'Pop stash' });
  await expect
    .element(pop.getByRole('combobox', { name: 'Stash' }))
    .toMatchTextContent(/Journey stash/);
  await pop.getByRole('button', { name: 'Pop stash' }).click();
  await expect.element(pop.getByText('succeeded')).toBeVisible();
  await expect
    .poll(async () => (await server.text(readme)).text)
    .toBe(repo.readme.changed);
  await expect.poll(stashes).toEqual([]);
  await userEvent.keyboard('{Escape}');
  await expect.element(pop).not.toBeInTheDocument();
});

test('popping a stash over a file changed since is refused with what Git said and keeps the stash', async ({
  pairedPage,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const local = 'Changed while the stash was set aside\n';
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
  await pop.getByRole('button', { name: 'Pop stash' }).click();
  await expect
    .element(pop.getByRole('alert'))
    .toMatchTextContent(/would be overwritten/);
  await expect.poll(async () => (await server.text(readme)).text).toBe(local);
  await expect
    .poll(async () =>
      ((await server.gitStatus()).branch?.stashes ?? []).map(
        (entry) => entry.message,
      ),
    )
    .toEqual([`On ${(await server.branches()).current}: Porcelain review`]);
});
