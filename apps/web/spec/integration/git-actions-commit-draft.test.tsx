import { page, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('without a coding CLI the commit dialog says drafting is unavailable, and a typed message still commits', async ({
  workspace,
  server,
}) => {
  const message = 'Commit written by hand';
  await expect.poll(() => server.commitModels()).toEqual([]);
  await workspace.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = workspace.getByRole('dialog', {
    name: 'Commit changes',
    exact: true,
  });
  const models = dialog.getByRole('combobox', {
    name: 'Commit model',
    exact: true,
  });
  await expect.element(models).toBeDisabled();
  await expect
    .element(models.getByText('No coding CLI available', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      dialog.getByRole('button', { name: 'Generate with AI', exact: true }),
    )
    .toBeDisabled();
  await expect
    .element(dialog.getByRole('tab', { name: 'Use groups', exact: true }))
    .toBeDisabled();
  const commit = dialog.getByRole('button', {
    name: 'Commit selected files',
    exact: true,
  });
  await expect.element(commit).toBeDisabled();

  await dialog
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill(message);
  await expect.element(commit).toBeEnabled();
  await commit.click();
  await expect
    .element(dialog.getByText('succeeded', { exact: true }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(message);
});

test.for([1440, 414])(
  'the commit dialog opens in the message so typing and Mod+Enter commit at %i px',
  async (width, { workspace, server }) => {
    await page.viewport(width, 896);
    try {
      const message = 'Commit typed from the keyboard';
      await workspace
        .getByRole('button', { name: 'Commit', exact: true })
        .click();
      const dialog = workspace.getByRole('dialog', {
        name: 'Commit changes',
        exact: true,
      });
      const field = dialog.getByRole('textbox', {
        name: 'Message',
        exact: true,
      });
      await expect.element(field).toHaveFocus();
      await userEvent.keyboard(message);
      await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
      await expect
        .element(dialog.getByText('succeeded', { exact: true }))
        .toBeVisible();
      await expect
        .poll(async () => (await server.commits()).commits[0]?.subject)
        .toBe(message);
    } finally {
      await page.viewport(414, 896);
    }
  },
);
