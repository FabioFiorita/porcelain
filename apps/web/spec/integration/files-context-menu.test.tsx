import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('a second right-click on another row opens that row’s menu', async ({
  render,
  repo,
  agent,
  server,
}) => {
  await agent.editFile({
    kind: 'create',
    path: 'alpha',
    entryKind: 'directory',
  });
  await agent.editFile({
    kind: 'create',
    path: 'beta',
    entryKind: 'directory',
  });
  await repo.write('alpha/first.md', 'First folder\n');
  await repo.write('beta/second.md', 'Second folder\n');
  await repo.write('guide.md', 'Guide\n');
  const page = await render.workspace();
  await page.viewport(1280, 800);
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  const row = (name: string) =>
    page.getByRole('treeitem', { name, exact: true, includeHidden: true });
  const menu = (path: string) =>
    page.getByRole('menu', { name: `${path} actions`, exact: true });

  for (const [first, firstPath, second, secondPath] of [
    ['alpha', 'alpha/', 'beta', 'beta/'],
    ['guide.md', 'guide.md', 'README.md', 'README.md'],
    ['alpha', 'alpha/', 'guide.md', 'guide.md'],
    ['guide.md', 'guide.md', 'beta', 'beta/'],
  ] as const) {
    await row(first).click({ button: 'right' });
    await expect.element(menu(firstPath)).toBeVisible();
    await expect.element(menu(firstPath)).toHaveFocus();
    await row(second).click({
      button: 'right',
      force: true,
      position: { x: 31, y: 12 },
    });
    await expect.element(menu(secondPath)).toBeVisible();
    await expect.element(menu(secondPath)).toHaveAttribute('data-open', '');
    await expect.element(menu(firstPath)).not.toBeInTheDocument();
    const command = secondPath.endsWith('/') ? 'New file' : 'Duplicate';
    await expect
      .element(page.getByRole('menuitem', { name: command, exact: true }))
      .toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
  }

  await row('alpha').click({ button: 'right' });
  await expect.element(menu('alpha/')).toBeVisible();
  await row('beta').click({
    button: 'right',
    force: true,
    position: { x: 31, y: 12 },
  });
  await expect.element(menu('beta/')).toBeVisible();
  await expect.element(menu('beta/')).toHaveAttribute('data-open', '');
  await page.getByRole('menuitem', { name: 'New folder', exact: true }).click();
  const name = page.getByRole('textbox', { name: /^Rename / });
  await name.fill('second-target');
  await expect.element(name).toHaveValue('second-target');
  await userEvent.keyboard('{Enter}');
  await expect
    .poll(async () =>
      (await server.directory('beta')).entries.map((entry) => entry.name),
    )
    .toContain('second-target');
  await expect
    .poll(async () =>
      (await server.directory('alpha')).entries.map((entry) => entry.name),
    )
    .not.toContain('second-target');
});
