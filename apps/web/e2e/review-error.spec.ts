import { expect, test } from '@playwright/test';
import { pairBrowser } from './playground';
import { openNavigation } from './workspace-navigation';

test('insets failed review cards with the tabs and recovers on retry', async ({
  page,
}) => {
  await page.route('**/changes', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{}',
    }),
  );
  await pairBrowser(page);
  await openNavigation(page);
  await page.getByRole('button', { name: /^review / }).click();
  const sidebar = page.getByRole('complementary', { name: 'Review sidebar' });
  if (!(await sidebar.isVisible()))
    await page.getByRole('button', { name: 'Review', exact: true }).click();
  const alert = sidebar.getByRole('alert');
  await expect(alert).toContainText('This review surface could not be loaded.');
  for (const dark of [false, true]) {
    await page.evaluate(
      (value) => document.documentElement.classList.toggle('dark', value),
      dark,
    );
    const card = await alert.boundingBox();
    const tabs = await sidebar.getByRole('tablist').boundingBox();
    expect(card).not.toBeNull();
    expect(tabs).not.toBeNull();
    if (!card || !tabs) throw new Error('Review navigation is not visible');
    expect(Math.abs(card.x - tabs.x)).toBeLessThan(1);
    expect(Math.abs(card.x + card.width - tabs.x - tabs.width)).toBeLessThan(1);
    await sidebar.screenshot({
      path: test
        .info()
        .outputPath(`review-error-${dark ? 'dark' : 'light'}.png`),
    });
  }
  await page.unroute('**/changes');
  await alert.getByRole('button', { name: 'Try again' }).click();
  await expect(alert).toHaveCount(0);
  await expect(
    sidebar.getByRole('button', { name: /^accessibility\.md/ }),
  ).toBeVisible();
});
