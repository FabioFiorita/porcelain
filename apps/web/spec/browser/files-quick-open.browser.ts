import { expect } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

const target = 'quick-target.md';

test('quick open finds a worktree file by name and opens it', async ({
  app,
  repo,
  server,
}) => {
  await repo.write(target, '# Quick target\n');
  await repo.write('.gitignore', 'build.log\n');
  await repo.write('build.log', 'ignored output\n');
  const opened = await app.open(await app.link('this'));
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Files', exact: true }).click();
  await expect
    .element(
      opened.getByRole('treeitem', { name: repo.readme.path, exact: true }),
    )
    .toBeVisible();
  await userEvent.keyboard('{ControlOrMeta>}p{/ControlOrMeta}');
  const search = opened.getByRole('combobox', {
    name: 'Find a file by name',
    exact: true,
  });
  await expect.element(search).toBeVisible();
  await search.fill('quick');
  await opened.getByRole('option', { name: target, exact: true }).click();
  await expect
    .element(opened.getByRole('heading', { name: 'Quick target', exact: true }))
    .toBeVisible();
  await expect.poll(async () => (await server.paths()).paths).toContain(target);
});

test('quick open finds no file an ignore rule hides', async ({ server }) => {
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await userEvent.keyboard('{ControlOrMeta>}p{/ControlOrMeta}');
  const search = page.getByRole('combobox', {
    name: 'Find a file by name',
    exact: true,
  });
  await expect.element(search).toBeVisible();
  await search.fill('build.log');
  await expect
    .element(page.getByText('No file matches that name.', { exact: true }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.paths()).paths)
    .not.toContain('build.log');
});
