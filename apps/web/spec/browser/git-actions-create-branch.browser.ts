import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

const topic = 'journey-topic';

test('creating a branch and switching to it puts the worktree on the new branch', async ({
  pairedPage,
  server,
}) => {
  const start = (await server.branches()).current;
  await pairedPage.getByRole('button', { name: 'Git actions' }).click();
  await pairedPage.getByRole('menuitem', { name: /^Create branch/ }).click();
  const dialog = pairedPage.getByRole('dialog', { name: 'Create branch' });
  await expect.element(dialog.getByText(`Starts from ${start}.`)).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Branch name' }).fill(topic);
  await dialog.getByRole('button', { name: 'Create branch' }).click();
  await expect.element(dialog).not.toBeInTheDocument();
  await expect.poll(async () => (await server.branches()).current).toBe(topic);

  await pairedPage.getByRole('button', { name: 'Git actions' }).click();
  await expect
    .element(pairedPage.getByRole('menu').getByText(topic, { exact: true }))
    .toBeVisible();
  await userEvent.keyboard('{Escape}');
});

test('creating a branch whose name is taken is refused with what Git said and creates nothing', async ({
  pairedPage,
  server,
}) => {
  const names = (await server.branches()).branches.map((branch) => branch.name);
  await pairedPage.getByRole('button', { name: 'Git actions' }).click();
  await pairedPage.getByRole('menuitem', { name: /^Create branch/ }).click();
  const dialog = pairedPage.getByRole('dialog', { name: 'Create branch' });
  await expect.element(dialog.getByText(`Starts from ${topic}.`)).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Branch name' }).fill(topic);
  await dialog.getByRole('button', { name: 'Create branch' }).click();
  await expect
    .element(dialog.getByRole('alert'))
    .toHaveTextContent(`fatal: a branch named '${topic}' already exists`);
  await expect
    .poll(async () =>
      (await server.branches()).branches.map((branch) => branch.name),
    )
    .toEqual(names);
  await expect.poll(async () => (await server.branches()).current).toBe(topic);
});
