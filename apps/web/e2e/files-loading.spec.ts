import { expect, test } from '@playwright/test';
import { pairBrowser } from './playground';
import { openNavigation } from './workspace-navigation';

/**
 * Folders load on demand, so browsing never waits on the repository-wide list
 * of names — and finding a file by name is its own thing, which says so when
 * it is slow and offers to try again when it fails.
 */
test('browses folders while search is slow, and says so when it fails', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let asked = 0;
  await page.route('**/paths', async (route) => {
    asked += 1;
    await gate;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{}',
    });
  });
  try {
    await pairBrowser(page);
    await openNavigation(page);
    await page.getByRole('button', { name: /^review / }).click();
    const files = page.getByRole('tab', { name: 'Files', exact: true });
    if (!(await files.isVisible()))
      await page.getByRole('button', { name: 'Review', exact: true }).click();
    await files.click();
    // The tree is there without the name list having answered at all.
    await expect(page.getByRole('treeitem').first()).toBeVisible();
    // And without it having been asked for: a repository's worth of names is
    // not worth reading for someone who never searches. Holding the request
    // would look the same from the screen, so count it instead.
    expect(asked).toBe(0);

    await expect(page.getByRole('button', { name: 'Go to file…' })).toHaveCount(
      0,
    );
    await page.keyboard.press('ControlOrMeta+p');
    await expect.poll(() => asked).toBe(1);
    await expect(page.getByText('Reading file names…')).toBeVisible();
    release();
    await expect(
      page.getByText(
        'Full file search could not be loaded. You can still browse folders.',
      ),
    ).toBeVisible();

    await page.unroute('**/paths');
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(
      page.getByText(
        'Full file search could not be loaded. You can still browse folders.',
      ),
    ).toHaveCount(0);
    // And a name from a folder nobody opened is now findable.
    await page
      .getByRole('combobox', { name: 'Find a file by name' })
      .fill('accessibility');
    await expect(
      page.getByRole('option', { name: /accessibility\.md/ }).first(),
    ).toBeVisible();
  } finally {
    release();
  }
});
