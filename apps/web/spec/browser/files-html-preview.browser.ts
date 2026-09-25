import { expect } from 'vitest';
import { page } from 'vitest/browser';
import { test } from '../kit/journey';

test('an HTML page opened from the file tree previews with its local images and names the ones it could not load', async ({
  app,
  repo,
}) => {
  await repo.write(
    'logo.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="teal"/></svg>\n',
  );
  await repo.write(
    'page.html',
    '<!doctype html><html><body><h1>Preview heading</h1><img src="logo.svg" alt="Preview logo"><img src="missing.png" alt="Missing picture"></body></html>\n',
  );
  const opened = await app.open(await app.link('this'));
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Files' }).click();
  await opened.getByRole('treeitem', { name: 'page.html' }).click();
  await expect
    .element(
      opened.getByText(
        'Some assets could not be loaded: missing.png. This preview supports local static assets.',
      ),
    )
    .toBeVisible();
  await expect
    .element(opened.getByRole('tab', { name: 'Preview' }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(opened.getByText(/could not be loaded: .*logo\.svg/))
    .not.toBeInTheDocument();
});

test('switching the HTML page to its source shows the markup instead of the preview', async () => {
  const source = page.getByRole('tab', { name: 'Source' });
  await source.click();
  await expect.element(source).toHaveAttribute('aria-selected', 'true');
  await expect
    .element(page.getByText(/<h1>Preview heading<\/h1>/))
    .toBeVisible();
  await expect
    .element(page.getByText(/^Some assets could not be loaded/))
    .not.toBeInTheDocument();
});
