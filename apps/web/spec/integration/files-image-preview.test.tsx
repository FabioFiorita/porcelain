import { expect, test, type Render, type Repo } from './fixtures.tsx';

const image = 'logo.svg';
const binary = 'data.bin';

async function openFiles(render: Render, repo: Repo) {
  await repo.write(
    image,
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="teal"/></svg>\n',
  );
  await repo.write(binary, 'binary\u0000content\n');
  return render.workspace();
}

test('a binary file opened from the file tree is not shown as text and says why', async ({
  render,
  repo,
}) => {
  const page = await openFiles(render, repo);
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await page
    .getByRole('treeitem', { name: binary, exact: true })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open file', exact: true }).click();
  await expect
    .element(page.getByText('Not shown', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      page.getByText(
        'This file is binary or uses an unsupported text encoding.',
        { exact: true },
      ),
    )
    .toBeVisible();
});
