import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';
import { expectInputFocus } from '../kit/focus.ts';

test('New file and New folder open inline names at phone width and create entries', async ({
  render,
  server,
}) => {
  const opened = await render.workspace();
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Files', exact: true }).click();
  const create = opened.getByRole('button', {
    name: 'Create file or folder',
    exact: true,
  });
  await expect.element(create).toBeVisible();
  await opened
    .getByRole('textbox', { name: 'Search files', exact: true })
    .click();
  await userEvent.keyboard('{Tab}');
  await expect.element(create).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  const newFile = opened.getByRole('menuitem', {
    name: 'New file',
    exact: true,
  });
  await expect.element(newFile).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  await expect.element(opened.getByRole('menu')).not.toBeInTheDocument();
  await expect.element(create).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  await expect.element(newFile).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  const fileName = opened.getByRole('textbox', { name: /rename/i });
  await expect.element(fileName).toBeVisible();
  await expectInputFocus(fileName);
  await userEvent.keyboard('phone-created.md');
  await expect.element(fileName).toHaveValue('phone-created.md');
  await userEvent.keyboard('{Enter}');
  await expect
    .poll(async () =>
      (await server.directory('')).entries.map((entry) => entry.name),
    )
    .toContain('phone-created.md');
  await expect
    .element(
      opened.getByRole('dialog', { name: 'Worktree review', exact: true }),
    )
    .not.toBeInTheDocument();
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Files', exact: true }).click();
  const createFolder = opened.getByRole('button', {
    name: 'Create file or folder',
    exact: true,
  });
  await expect.element(createFolder).toBeVisible();
  await opened
    .getByRole('textbox', { name: 'Search files', exact: true })
    .click();
  await userEvent.keyboard('{Tab}');
  await expect.element(createFolder).toHaveFocus();
  await userEvent.keyboard('{Enter}{ArrowDown}');
  await expect
    .element(opened.getByRole('menuitem', { name: 'New folder', exact: true }))
    .toHaveFocus();
  await userEvent.keyboard('{Enter}');
  const folderName = opened.getByRole('textbox', { name: /rename/i });
  await expect.element(folderName).toBeVisible();
  await expectInputFocus(folderName);
  await userEvent.keyboard('phone-folder');
  await expect.element(folderName).toHaveValue('phone-folder');
  await userEvent.keyboard('{Enter}');
  await expect
    .poll(async () =>
      (await server.directory('')).entries.map((entry) => entry.name),
    )
    .toContain('phone-folder');
});
