import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('one click opens a single-child folder chain and one click closes it', async ({
  repo,
  render,
  agent,
}) => {
  await agent.editFile({ kind: 'create', path: 'a', entryKind: 'directory' });
  await agent.editFile({ kind: 'create', path: 'a/b', entryKind: 'directory' });
  await repo.write('a/b/first.txt', 'First file\n');
  await repo.write('a/b/second.txt', 'Second file\n');
  const page = await render.workspace();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();

  await page.getByRole('treeitem', { name: 'a', exact: true }).click();
  await expect
    .element(page.getByRole('treeitem', { name: 'first.txt', exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole('treeitem', { name: 'second.txt', exact: true }))
    .toBeVisible();
  await page.getByRole('treeitem', { name: 'a / b', exact: true }).click();
  await expect
    .element(page.getByRole('treeitem', { name: 'first.txt', exact: true }))
    .not.toBeInTheDocument();
  await userEvent.keyboard('{ArrowRight}');
  await expect
    .element(page.getByRole('treeitem', { name: 'first.txt', exact: true }))
    .toBeVisible();
  await userEvent.keyboard('{ArrowLeft}');
  await expect
    .element(page.getByRole('treeitem', { name: 'first.txt', exact: true }))
    .not.toBeInTheDocument();
});

test('one click opens a three-level single-child folder chain', async ({
  repo,
  render,
  agent,
  fetchGate,
}) => {
  await agent.editFile({ kind: 'create', path: 'a', entryKind: 'directory' });
  await agent.editFile({ kind: 'create', path: 'a/b', entryKind: 'directory' });
  await agent.editFile({
    kind: 'create',
    path: 'a/b/c',
    entryKind: 'directory',
  });
  await repo.write('a/b/c/deep.txt', 'Deep file\n');
  const reads = fetchGate.recordDirectoryReads();
  const page = await render.workspace();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await page.getByRole('treeitem', { name: 'a', exact: true }).click();
  await expect
    .element(page.getByRole('treeitem', { name: 'deep.txt', exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole('treeitem', { name: 'a / b / c', exact: true }))
    .toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => reads).toContain('a');
  await expect.poll(() => reads).toContain('a/b');
  await expect.poll(() => reads).toContain('a/b/c');
});

test('closing a folder before its lazy read finishes keeps its new chain closed', async ({
  repo,
  render,
  agent,
  fetchGate,
}) => {
  await agent.editFile({ kind: 'create', path: 'a', entryKind: 'directory' });
  await agent.editFile({ kind: 'create', path: 'a/b', entryKind: 'directory' });
  await repo.write('a/b/unread.txt', 'Do not load yet\n');
  const reads = fetchGate.recordDirectoryReads();
  const held = fetchGate.holdNextDirectoryRead();
  const page = await render.workspace();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  held.arm();
  try {
    const folder = page.getByRole('treeitem', { name: 'a', exact: true });
    await folder.click();
    await held.requested;
    await expect.element(folder).toHaveAttribute('aria-expanded', 'true');
    await folder.click();
    await expect.element(folder).toHaveAttribute('aria-expanded', 'false');
    held.release();
    await expect
      .element(page.getByRole('treeitem', { name: 'a / b', exact: true }))
      .toHaveAttribute('aria-expanded', 'false');
    await expect
      .element(page.getByRole('treeitem', { name: 'unread.txt', exact: true }))
      .not.toBeInTheDocument();
    await expect.poll(() => reads).toContain('a');
    await expect.poll(() => reads).not.toContain('a/b');
  } finally {
    held.release();
  }
});
