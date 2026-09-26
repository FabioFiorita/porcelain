import { expect } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

const folder = 'archive';
const moved = 'move-me.md';
const clash = 'clash.md';

test('dragging a file onto a folder in the tree moves it into that folder on disk', async ({
  agent,
  app,
  repo,
  server,
}) => {
  await agent.editFile({
    kind: 'create',
    path: folder,
    entryKind: 'directory',
  });
  await repo.write(`${folder}/${clash}`, 'Already in the folder\n');
  await repo.write(moved, 'Notes to move\n');
  await repo.write(clash, 'Notes that clash\n');
  const opened = await app.open(await app.link('this'));
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Files' }).click();
  await userEvent.dragAndDrop(
    opened.getByRole('treeitem', { name: moved }),
    opened.getByRole('treeitem', { name: folder }),
  );
  await expect
    .poll(async () =>
      (await server.directory(folder)).entries.map(({ name }) => name),
    )
    .toContain(moved);
  await expect
    .poll(async () =>
      (await server.directory('')).entries.map(({ name }) => name),
    )
    .not.toContain(moved);
  await expect
    .element(opened.getByRole('treeitem', { name: moved }))
    .not.toBeInTheDocument();
  await expect
    .element(opened.getByText('Change no longer present'))
    .not.toBeInTheDocument();
});

test('dragging a file onto a folder that already holds that name is refused and keeps both files', async ({
  server,
}) => {
  await userEvent.dragAndDrop(
    page.getByRole('treeitem', { name: clash }),
    page.getByRole('treeitem', { name: folder }),
  );
  await expect
    .element(page.getByRole('alert'))
    .toHaveTextContent('An entry already exists at that path');
  await expect
    .element(page.getByRole('treeitem', { name: clash }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.text(clash)).text)
    .toBe('Notes that clash\n');
  await expect
    .poll(async () => (await server.text(`${folder}/${clash}`)).text)
    .toBe('Already in the folder\n');
});
