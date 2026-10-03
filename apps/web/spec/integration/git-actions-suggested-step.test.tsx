import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('the Git button suggests applying a waiting stash once the tree is clean, and applying it brings the changes back', async ({
  workspace,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const suggestion = workspace.getByRole('button', {
    name: 'Apply stash',
    exact: true,
  });
  await expect
    .element(workspace.getByRole('button', { name: 'Commit', exact: true }))
    .toBeVisible();
  await expect.element(suggestion).not.toBeInTheDocument();

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
  await expect.poll(async () => (await server.changes()).changes).toEqual([]);

  await expect.element(suggestion).toBeVisible();
  await expect.element(suggestion).toHaveTextContent('Apply stash');
  await suggestion.click();
  const apply = workspace.getByRole('dialog', {
    name: 'Apply stash',
    exact: true,
  });
  await expect
    .element(
      apply.getByText(
        'Its changes come back into the working tree and the stash is kept.',
        { exact: true },
      ),
    )
    .toBeVisible();
  await expect.element(apply.getByText(/set aside/)).not.toBeInTheDocument();
  await apply.getByRole('button', { name: 'Apply stash', exact: true }).click();
  await expect
    .element(apply.getByText('succeeded', { exact: true }))
    .toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect
    .poll(async () => (await server.text(readme)).text)
    .toBe(repo.readme.changed);
  await expect
    .poll(async () => (await server.gitStatus()).branch?.stashes.length)
    .toBe(1);
  await expect.element(suggestion).not.toBeInTheDocument();
});
