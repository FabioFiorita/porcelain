import { expect, test } from './fixtures.ts';

test('an open Git actions menu keeps the code beneath it from scrolling', async ({
  app,
  page,
  repo,
}) => {
  await repo.write(
    'long.txt',
    `${Array.from({ length: 400 }, (_, index) => `line ${index + 1}`).join('\n')}\n`,
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await app.open(await app.link('this'));
  await expect(
    page.getByRole('region', { name: 'Review content', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('ControlOrMeta+p');
  await page
    .getByRole('combobox', { name: 'Find a file by name', exact: true })
    .fill('long.txt');
  await page.getByRole('option', { name: 'long.txt', exact: true }).click();
  const code = page.getByRole('region', { name: 'Code content', exact: true });
  const first = code.getByText('line 1', { exact: true });
  const fortieth = code.getByText('line 40', { exact: true });
  await expect(first).toBeInViewport();
  const wheelOverCode = async (delta: number) => {
    const box = await code.boundingBox();
    if (!box) throw new Error('The code content is not on screen');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, delta);
  };

  await expect(async () => {
    await wheelOverCode(600);
    await expect(fortieth).toBeInViewport({ timeout: 1000 });
  }).toPass();
  await expect(async () => {
    await wheelOverCode(-3000);
    await expect(first).toBeInViewport({ timeout: 1000 });
  }).toPass();

  await page.getByRole('button', { name: 'Git actions', exact: true }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await wheelOverCode(600);
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).not.toBeAttached();
  await expect(first).toBeInViewport();
});
