import { expect, test, type Render, type Repo } from './fixtures.tsx';

const large = 'large.md';

async function openFiles(render: Render, repo: Repo) {
  await repo.write(
    large,
    `# Large\n\n${'A long line of notes.\n'.repeat(60_000)}`,
  );
  const opened = await render.workspace();
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Files', exact: true }).click();
  return opened;
}

test('a Markdown file opened from the file tree reads as formatted text and switches to its source', async ({
  render,
  repo,
  server,
}) => {
  const opened = await openFiles(render, repo);
  const file = opened.getByRole('treeitem', {
    name: repo.readme.path,
    exact: true,
  });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await opened
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  const reader = opened.getByRole('tab', { name: 'Reader', exact: true });
  await expect.element(reader).toHaveAttribute('aria-selected', 'true');
  await expect
    .element(
      opened.getByRole('heading', { name: 'Sample repository', exact: true }),
    )
    .toBeVisible();

  const source = opened.getByRole('tab', { name: 'Source', exact: true });
  await source.click();
  await expect.element(source).toHaveAttribute('aria-selected', 'true');
  await expect
    .element(opened.getByText('# Sample repository', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      opened.getByRole('heading', { name: 'Sample repository', exact: true }),
    )
    .not.toBeInTheDocument();
  await expect
    .poll(async () => (await server.text(repo.readme.path)).text)
    .toBe(repo.readme.changed);
});

test('a Markdown file too large to read as text is not shown and says why', async ({
  render,
  repo,
}) => {
  const page = await openFiles(render, repo);
  await page
    .getByRole('treeitem', { name: large, exact: true })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open file', exact: true }).click();
  await expect
    .element(page.getByText('Not shown', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      page.getByText('This file is too large to display as text.', {
        exact: true,
      }),
    )
    .toBeVisible();
});
