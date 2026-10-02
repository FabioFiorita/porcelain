import { userEvent } from 'vitest/browser';
import {
  expect,
  test,
  type Agent,
  type Render,
  type Repo,
} from './fixtures.tsx';

const folder = 'archive';
const moved = 'move-me.md';
const clash = 'clash.md';

async function openFiles(agent: Agent, render: Render, repo: Repo) {
  await agent.editFile({
    kind: 'create',
    path: folder,
    entryKind: 'directory',
  });
  await repo.write(`${folder}/${clash}`, 'Already in the folder\n');
  await repo.write(moved, 'Notes to move\n');
  await repo.write(clash, 'Notes that clash\n');
  const opened = await render.workspace();
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Files', exact: true }).click();
  return opened;
}

test('dragging a file onto a folder in the tree moves it into that folder on disk', async ({
  agent,
  render,
  repo,
  server,
}) => {
  const opened = await openFiles(agent, render, repo);
  await userEvent.dragAndDrop(
    opened.getByRole('treeitem', { name: moved, exact: true }),
    opened.getByRole('treeitem', { name: folder, exact: true }),
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
    .element(opened.getByRole('treeitem', { name: moved, exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(opened.getByText('Change no longer present', { exact: true }))
    .not.toBeInTheDocument();
});

test('dragging a file onto a folder that already holds that name is refused and keeps both files', async ({
  agent,
  render,
  repo,
  server,
}) => {
  const page = await openFiles(agent, render, repo);
  await userEvent.dragAndDrop(
    page.getByRole('treeitem', { name: clash, exact: true }),
    page.getByRole('treeitem', { name: folder, exact: true }),
  );
  await expect
    .element(page.getByRole('alert'))
    .toHaveTextContent('An entry already exists at that path');
  await expect
    .element(page.getByRole('treeitem', { name: clash, exact: true }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.text(clash)).text)
    .toBe('Notes that clash\n');
  await expect
    .poll(async () => (await server.text(`${folder}/${clash}`)).text)
    .toBe('Already in the folder\n');
});
