import { expect } from 'vitest';
import { page } from 'vitest/browser';
import { test } from '../kit/journey';

const large = 'large.md';

test('a Markdown file opened from the file tree reads as formatted text and switches to its source', async ({
  app,
  repo,
  server,
}) => {
  await repo.write(
    large,
    `# Large\n\n${'A long line of notes.\n'.repeat(60_000)}`,
  );
  const opened = await app.open(await app.link('this'));
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Files' }).click();
  const file = opened.getByRole('treeitem', { name: repo.readme.path });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await opened.getByRole('menuitem', { name: 'Open file' }).click();
  const reader = opened.getByRole('tab', { name: 'Reader' });
  await expect.element(reader).toHaveAttribute('aria-selected', 'true');
  await expect
    .element(opened.getByRole('heading', { name: 'Sample repository' }))
    .toBeVisible();

  const source = opened.getByRole('tab', { name: 'Source' });
  await source.click();
  await expect.element(source).toHaveAttribute('aria-selected', 'true');
  await expect
    .element(opened.getByText('# Sample repository', { exact: true }))
    .toBeVisible();
  await expect
    .element(opened.getByRole('heading', { name: 'Sample repository' }))
    .not.toBeInTheDocument();
  await expect
    .poll(async () => (await server.text(repo.readme.path)).text)
    .toBe(repo.readme.changed);
});

test('a Markdown file too large to read as text is not shown and says why', async () => {
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files' }).click();
  await page.getByRole('treeitem', { name: large }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open file' }).click();
  await expect.element(page.getByText('Not shown')).toBeVisible();
  await expect
    .element(page.getByText('This file is too large to display as text.'))
    .toBeVisible();
});
