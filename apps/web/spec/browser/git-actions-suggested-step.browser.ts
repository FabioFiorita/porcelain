import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

test('the Git button suggests applying a waiting stash once the tree is clean, and applying it brings the changes back', async ({
  pairedPage,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const suggestion = pairedPage.getByRole('button', {
    name: 'Apply stash',
    exact: true,
  });
  await expect
    .element(pairedPage.getByRole('button', { name: 'Commit', exact: true }))
    .toBeVisible();
  await expect.element(suggestion).not.toBeInTheDocument();

  await pairedPage
    .getByRole('button', { name: 'Git actions', exact: true })
    .click();
  await pairedPage.getByRole('menuitem', { name: /^Stash changes/ }).click();
  const stash = pairedPage.getByRole('dialog', {
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
  const apply = pairedPage.getByRole('dialog', {
    name: 'Apply stash',
    exact: true,
  });
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
