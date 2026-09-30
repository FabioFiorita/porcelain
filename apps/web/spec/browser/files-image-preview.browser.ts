import { expect } from 'vitest';
import { page } from 'vitest/browser';
import { test } from '../kit/journey';

const image = 'logo.svg';
const binary = 'data.bin';

test('an image opened from the file tree shows as a picture', async ({
  app,
  repo,
}) => {
  await repo.write(
    image,
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="teal"/></svg>\n',
  );
  await repo.write(binary, 'binary\u0000content\n');
  const opened = await app.open(await app.link('this'));
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Files', exact: true }).click();
  await opened.getByRole('treeitem', { name: image, exact: true }).click();
  await expect
    .element(opened.getByRole('img', { name: image, exact: true }))
    .toBeVisible();
});

test('a binary file opened from the file tree is not shown as text and says why', async () => {
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
