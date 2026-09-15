import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { openNavigation } from './workspace-navigation';

test('renders repository images and HTML with local CSS and image assets', async ({
  page,
}) => {
  const info = process.env.PORCELAIN_PLAYGROUND_INFO;
  if (!info) throw new Error('Missing isolated playground');
  const { tokenFile, worktreePath } = JSON.parse(await readFile(info, 'utf8'));
  const stem = `preview-${test.info().project.name}`;
  const imagePath = `${stem}.png`;
  const htmlPath = `${stem}.html`;
  await writeFile(
    join(worktreePath, imagePath),
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    ),
  );
  await writeFile(
    join(worktreePath, `${stem}.css`),
    `body { background: rgb(12, 34, 56); color: white } #sample { width: 120px; height: 120px; background-image: url("./${imagePath}") }`,
  );
  await writeFile(
    join(worktreePath, htmlPath),
    `<!doctype html><link rel="stylesheet" href="./${stem}.css"><h1>Styled local preview</h1><img alt="Local image" src="./${imagePath}"><div id="sample"></div>`,
  );
  await page.goto('/');
  await page.getByLabel('Access token').fill(await readFile(tokenFile, 'utf8'));
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await openNavigation(page);
  await page.getByRole('button', { name: /^review / }).click();
  async function openFile(path: string) {
    const files = page.getByRole('tab', { name: 'Files', exact: true });
    if (!(await files.isVisible()))
      await page.getByRole('button', { name: 'Review', exact: true }).click();
    await files.click();
    await page.getByPlaceholder('Search…').fill(path);
    await page.getByRole('treeitem', { name: path, exact: true }).click();
  }
  await openFile(imagePath);
  const image = page.getByRole('img', { name: imagePath, exact: true });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
    .toBe(1);
  await page.screenshot({ path: test.info().outputPath('image-preview.png') });
  await openFile(htmlPath);
  const frame = page.frameLocator(`iframe[title="${htmlPath}"]`);
  await expect(
    frame.getByRole('heading', { name: 'Styled local preview' }),
  ).toBeVisible();
  await expect(frame.locator('body')).toHaveCSS(
    'background-color',
    'rgb(12, 34, 56)',
  );
  await expect
    .poll(() =>
      frame
        .getByAltText('Local image')
        .evaluate((node: HTMLImageElement) => node.naturalWidth),
    )
    .toBe(1);
  await expect(frame.locator('#sample')).toHaveCSS(
    'background-image',
    /data:image\/png;base64/,
  );
  await page.screenshot({ path: test.info().outputPath('html-preview.png') });
});
