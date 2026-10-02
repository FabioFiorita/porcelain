import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('stashing sets the changes aside and popping the stash brings them back', async ({
  workspace,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const stashes = async () =>
    ((await server.gitStatus()).branch?.stashes ?? []).map(
      (entry) => entry.message,
    );
  await workspace
    .getByRole('button', { name: 'Git actions', exact: true })
    .click();
  await workspace.getByRole('menuitem', { name: /^Stash changes/ }).click();
  const stash = workspace.getByRole('dialog', {
    name: 'Stash changes',
    exact: true,
  });
  await stash
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Journey stash');
  await stash
    .getByRole('button', { name: 'Stash changes', exact: true })
    .click();
  await expect
    .element(stash.getByText('succeeded', { exact: true }))
    .toBeVisible();
  await expect.poll(async () => (await server.changes()).changes).toEqual([]);
  await expect
    .poll(stashes)
    .toEqual([`On ${(await server.gitStatus()).branch?.name}: Journey stash`]);
  await userEvent.keyboard('{Escape}');
  await expect.element(stash).not.toBeInTheDocument();

  await workspace
    .getByRole('button', { name: 'Git actions', exact: true })
    .click();
  await workspace.getByRole('menuitem', { name: /^Pop stash/ }).click();
  const pop = workspace.getByRole('dialog', {
    name: 'Pop stash',
    exact: true,
  });
  await expect
    .element(pop.getByRole('combobox', { name: 'Stash', exact: true }))
    .toMatchTextContent(/Journey stash/);
  await pop.getByRole('button', { name: 'Pop stash', exact: true }).click();
  await expect
    .element(pop.getByText('succeeded', { exact: true }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.text(readme)).text)
    .toBe(repo.readme.changed);
  await expect.poll(stashes).toEqual([]);
  await userEvent.keyboard('{Escape}');
  await expect.element(pop).not.toBeInTheDocument();
});

test('popping a stash over a file changed since is refused with what Git said and keeps the stash', async ({
  workspace,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const local = 'Changed while the stash was set aside\n';
  await workspace
    .getByRole('button', { name: 'Git actions', exact: true })
    .click();
  await workspace.getByRole('menuitem', { name: /^Stash changes/ }).click();
  const stash = workspace.getByRole('dialog', {
    name: 'Stash changes',
    exact: true,
  });
  await stash
    .getByRole('button', { name: 'Stash changes', exact: true })
    .click();
  await expect
    .element(stash.getByText('succeeded', { exact: true }))
    .toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect.element(stash).not.toBeInTheDocument();

  await repo.write(readme, local);
  await expect
    .element(
      workspace.getByRole('button', {
        name: `Mark ${readme} as reviewed`,
        exact: true,
      }),
    )
    .toBeVisible();
  await workspace
    .getByRole('button', { name: 'Git actions', exact: true })
    .click();
  await workspace.getByRole('menuitem', { name: /^Pop stash/ }).click();
  const pop = workspace.getByRole('dialog', {
    name: 'Pop stash',
    exact: true,
  });
  await pop.getByRole('button', { name: 'Pop stash', exact: true }).click();
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
    .toEqual([
      `On ${(await server.gitStatus()).branch?.name}: Porcelain review`,
    ]);
});
