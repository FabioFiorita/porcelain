import { expect, test } from './fixtures.ts';
import { updateFeed } from '../kit/desktop-updates.ts';

for (const native of [false, true]) {
  test(`the navigator reserves window controls only with the native bridge ${native}`, async ({
    pairedPage: page,
    app,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    if (native) {
      await updateFeed(page, false);
      await app.reload();
    }
    const navigator = page.getByRole('navigation', {
      name: 'Projects and worktrees',
      exact: true,
    });
    const title = navigator.getByText('Porcelain', { exact: true });
    await expect(title).toBeVisible();
    await expect
      .poll(async () => {
        const box = await navigator.boundingBox();
        const label = await title.boundingBox();
        if (!box || !label) throw new Error('Navigator title is not visible');
        return Math.round(label.x - box.x);
      })
      .toBe(native ? 82 : 8);
  });
}
