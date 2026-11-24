import { page as browserPage, userEvent } from 'vite-plus/test/browser';
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
    .element(
      opened.getByText('This change is no longer present.', { exact: true }),
    )
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

test('dragging two open files into a folder moves both tabs with them', async ({
  agent,
  render,
  repo,
}) => {
  await browserPage.viewport(1280, 896);
  try {
    await agent.editFile({
      kind: 'create',
      path: folder,
      entryKind: 'directory',
    });
    await repo.write('first.md', 'First note\n');
    await repo.write('second.md', 'Second note\n');
    const page = await render.workspace();
    await userEvent.keyboard('{Alt>}1{/Alt}');
    const first = page.getByRole('treeitem', { name: 'first.md', exact: true });
    const second = page.getByRole('treeitem', {
      name: 'second.md',
      exact: true,
    });
    await first.click();
    await second.click();
    await expect
      .element(page.getByRole('tab', { name: 'second.md', exact: true }))
      .toHaveAttribute('aria-selected', 'true');
    await first.click({ modifiers: ['ControlOrMeta'] });
    await userEvent.dragAndDrop(
      second,
      page.getByRole('treeitem', { name: folder, exact: true }),
    );
    const firstTab = page.getByRole('tab', {
      name: `${folder}/first.md`,
      exact: true,
    });
    const secondTab = page.getByRole('tab', {
      name: `${folder}/second.md`,
      exact: true,
    });
    await expect
      .element(firstTab)
      .toHaveAttribute('data-entry', `file:${folder}/first.md`);
    await expect
      .element(secondTab)
      .toHaveAttribute('data-entry', `file:${folder}/second.md`);
    for (const stale of ['first.md', 'second.md'])
      await expect
        .element(page.getByRole('tab', { name: stale, exact: true }))
        .not.toBeInTheDocument();
    await expect.element(secondTab).toHaveAttribute('aria-selected', 'true');
  } finally {
    await browserPage.viewport(414, 896);
  }
});
