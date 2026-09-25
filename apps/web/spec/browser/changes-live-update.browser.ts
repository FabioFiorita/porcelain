import { expect } from 'vitest';
import { test } from '../kit/journey';

const note = 'live-note.md';

test('an open file another writer rewrites on disk shows the new text without a reload', async ({
  pairedPage,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const rewritten = 'Rewritten by another writer while the page is open.';
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files' }).click();
  const file = pairedPage.getByRole('treeitem', { name: readme });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await pairedPage.getByRole('menuitem', { name: 'Open file' }).click();
  await expect
    .element(pairedPage.getByText('A change to review.', { exact: true }))
    .toBeVisible();
  const source = pairedPage.getByRole('tab', { name: 'Source' });
  await source.click();
  await expect.element(source).toHaveAttribute('aria-selected', 'true');

  await repo.write(readme, `# Sample repository\n\n${rewritten}\n`);
  await expect
    .poll(async () => (await server.text(readme)).text)
    .toContain(rewritten);
  await expect
    .element(pairedPage.getByText(rewritten, { exact: true }))
    .toBeVisible();
  await expect
    .element(pairedPage.getByText('A change to review.', { exact: true }))
    .not.toBeInTheDocument();
  await expect.element(source).toHaveAttribute('aria-selected', 'true');
});

test('a file another writer creates on disk appears in the open file tree and changes list without a reload', async ({
  pairedPage,
  repo,
  server,
}) => {
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  const files = pairedPage.getByRole('tab', { name: 'Files' });
  await files.click();
  await expect
    .element(pairedPage.getByRole('treeitem', { name: repo.readme.path }))
    .toBeVisible();
  await repo.write(note, 'Written by another writer.\n');
  await expect
    .poll(async () => (await server.changes()).changes.map(({ path }) => path))
    .toContain(note);
  await expect
    .element(pairedPage.getByRole('treeitem', { name: note }))
    .toBeVisible();
  await expect.element(files).toHaveAttribute('aria-selected', 'true');
  await pairedPage.getByRole('tab', { name: 'Changes' }).click();
  await expect
    .element(pairedPage.getByRole('button', { name: `${note} · untracked` }))
    .toBeVisible();
});

test('a file another writer removes from disk leaves the open changes list and file tree without a reload', async ({
  pairedPage,
  repo,
  server,
}) => {
  const row = pairedPage.getByRole('button', { name: `${note} · untracked` });
  await expect.element(row).toBeVisible();
  await repo.remove(note);
  await expect
    .poll(async () => (await server.changes()).changes.map(({ path }) => path))
    .not.toContain(note);
  await expect.element(row).not.toBeInTheDocument();
  await expect
    .element(pairedPage.getByRole('button', { name: /^README\.md · / }))
    .toBeVisible();
  await pairedPage.getByRole('tab', { name: 'Files' }).click();
  await expect
    .element(pairedPage.getByRole('treeitem', { name: repo.readme.path }))
    .toBeVisible();
  await expect
    .element(pairedPage.getByRole('treeitem', { name: note }))
    .not.toBeInTheDocument();
});
