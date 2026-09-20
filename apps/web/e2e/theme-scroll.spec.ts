import { expect, test } from '@playwright/test';
import { pairBrowser } from './playground';
import { openNavigation } from './workspace-navigation';

test('scrolls navigation and keeps file search readable in both themes', async ({
  page,
}, testInfo) => {
  await pairBrowser(page);
  await openNavigation(page);
  const navigation = page.getByRole('navigation', {
    name: 'Projects and worktrees',
  });
  const viewport = navigation.locator('[data-slot="scroll-area-viewport"]');
  // Constrain the panel to exercise overflow even with a small fixture inventory.
  await navigation.evaluate((element) => {
    element.style.height = '220px';
  });
  await expect
    .poll(() =>
      viewport.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    )
    .toBe(true);
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await expect(
    navigation.getByRole('button', { name: 'Settings', exact: true }),
  ).toBeInViewport();
  await navigation.evaluate((element) => {
    element.style.height = '';
  });
  await page.getByRole('button', { name: /^review / }).click();
  const files = page.getByRole('tab', { name: 'Files', exact: true });
  if (!(await files.isVisible()))
    await page.getByRole('button', { name: 'Review', exact: true }).click();
  await files.click();
  const tree = page.locator('[data-slot="file-tree"]');
  await expect(page.getByRole('treeitem').first()).toBeVisible();
  for (const theme of ['dark', 'light']) {
    await page.evaluate((value) => {
      document.documentElement.classList.toggle('dark', value === 'dark');
    }, theme);
    await page.getByRole('treeitem').first().click();
    await page.keyboard.type('readme');
    const input = tree.getByPlaceholder('Search…');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('readme');
    const colors = await input.evaluate((element) => {
      const style = getComputedStyle(element);
      const probe = document.createElement('span');
      probe.style.backgroundColor = 'var(--muted)';
      probe.style.color = 'var(--foreground)';
      document.body.append(probe);
      const expected = getComputedStyle(probe);
      const result = {
        background: style.backgroundColor,
        foreground: style.color,
        scheme: style.colorScheme,
        expectedBackground: expected.backgroundColor,
        expectedForeground: expected.color,
      };
      probe.remove();
      return result;
    });
    expect(colors.background).toBe(colors.expectedBackground);
    expect(colors.foreground).toBe(colors.expectedForeground);
    expect(colors.scheme).toBe(theme);
    await expect(
      page.getByRole('treeitem', { name: 'README.md', exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${theme}.png`) });
    await page.keyboard.press('Escape');
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
