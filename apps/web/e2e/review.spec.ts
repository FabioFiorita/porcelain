import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';
import { openNavigation } from './workspace-navigation';

async function connect(page: Page) {
  const manifest = process.env.PORCELAIN_PLAYGROUND_INFO;
  if (!manifest) throw new Error('Missing playground manifest');
  const { tokenFile } = JSON.parse(await readFile(manifest, 'utf8')) as {
    tokenFile: string;
  };
  await page.getByLabel('Access token').fill(await readFile(tokenFile, 'utf8'));
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.getByLabel('Access token')).toHaveCount(0);
}

test('keeps keyboard focus on visible controls when desktop navigation is collapsed', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await connect(page);
  await openNavigation(page);
  const toggle = page.getByRole('button', {
    name: 'Toggle Sidebar',
    exact: true,
  });
  await toggle.click();
  // Reverse tabbing must never reach the preceding, offscreen project panel.
  await page.keyboard.press('Shift+Tab');
  await expect(
    page
      .getByRole('navigation', { name: 'Projects and worktrees' })
      .locator(':focus'),
  ).toHaveCount(0);
  await toggle.focus();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Refresh review' }),
  ).toBeFocused();
  await toggle.click();
  await expect(
    page.getByRole('button', { name: 'Disconnect', exact: true }),
  ).toBeVisible();
});

test('keeps both sidebar controls reachable and ignores workspace shortcuts while editing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByLabel('Access token').fill('Session draft');
  await page.keyboard.press('Alt+Shift+d');
  await expect(page.getByLabel('Access token')).toHaveValue('Session draft');
  await expect(page.locator('html')).not.toHaveClass('dark');
  await connect(page);
  await page.getByRole('button', { name: /^review / }).click();
  const left = page.getByRole('button', {
    name: 'Toggle Sidebar',
    exact: true,
  });
  const right = page.getByRole('button', {
    name: /^(Hide|Show) review sidebar$/,
  });
  const navigator = page.getByRole('navigation', {
    name: 'Projects and worktrees',
  });
  const review = page.getByRole('complementary', { name: 'Review sidebar' });
  const divider = page.locator('[data-slot="resizable-handle"]');
  const leftBox = await left.boundingBox();
  const rightBox = await right.boundingBox();
  expect(leftBox?.y).toBe(rightBox?.y);
  await expect(divider).toBeVisible();
  const reviewWidth = (await review.boundingBox())?.width;
  await divider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect
    .poll(async () => (await review.boundingBox())?.width)
    .not.toBe(reviewWidth);
  await page
    .getByRole('navigation', { name: 'Projects and worktrees' })
    .getByRole('button')
    .first()
    .focus();
  await page.keyboard.press('ControlOrMeta+b');
  await expect(left).toBeFocused();
  await expect(left).toHaveAttribute('aria-expanded', 'false');
  await expect(navigator).not.toBeInViewport();
  await page.keyboard.press('Alt+Shift+r');
  await expect(review).toBeHidden();
  await expect(left).toBeInViewport();
  await expect(right).toBeInViewport();
  await page.keyboard.press('Alt+Shift+r');
  await expect(review).toBeVisible();
  await page.keyboard.press('ControlOrMeta+b');
  await expect(navigator).toBeVisible();
  await page
    .getByRole('button', { name: /README\.md.*staged/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Add comment', exact: true }).click();
  const comment = page.getByLabel('Comment', { exact: true });
  await comment.fill('Keep my review draft');
  for (const shortcut of ['ControlOrMeta+b', 'Alt+Shift+r', 'Alt+Shift+d']) {
    await page.keyboard.press(shortcut);
  }
  await expect(comment).toHaveValue('Keep my review draft');
  await expect(navigator).toBeVisible();
  await expect(review).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass('dark');
  // Contenteditable descendants are another typing surface supported by Hotkeys.
  await page.evaluate(() => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.setAttribute('aria-label', 'Editable fixture');
    editor.textContent = 'Draft';
    document.body.append(editor);
    editor.focus();
  });
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.press('Alt+Shift+r');
  await expect(navigator).toBeVisible();
  await expect(review).toBeVisible();
  await page
    .getByLabel('Editable fixture')
    .evaluate((element) => element.remove());
  await right.focus();
  await page.keyboard.press('Alt+Shift+d');
  await expect(page.locator('html')).toHaveClass('dark');
  await page.getByRole('button', { name: 'Close review sidebar' }).click();
  await expect(right).toBeFocused();
});

test('keyboard focus selects which split pane receives document shortcuts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await connect(page);
  await page.getByRole('button', { name: /^review / }).click();
  await page
    .getByRole('button', { name: /README\.md.*staged/ })
    .first()
    .click();
  const unsplitTab = page.getByRole('tab', { name: /README\.md/ });
  await unsplitTab.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open to the side' }).click();

  const leftTabs = page.getByRole('tablist', {
    name: 'Open documents, left pane',
  });
  const rightTabs = page.getByRole('tablist', {
    name: 'Open documents, right pane',
  });
  await leftTabs.getByRole('tab', { name: /Handoff/ }).focus();
  await page.keyboard.press('Alt+w');

  await expect(leftTabs.getByRole('tab', { name: /README\.md/ })).toHaveCount(
    0,
  );
  await expect(
    rightTabs.getByRole('tab', { name: /README\.md/ }),
  ).toHaveCount(1);
});

test('opens responsive drawers with shortcuts and returns to the review canvas', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await connect(page);
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Toggle Sidebar', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('ControlOrMeta+b');
  await page.getByRole('button', { name: /^review / }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Toggle Sidebar', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Alt+Shift+r');
  await expect(
    page.getByRole('dialog', { name: 'Worktree review' }),
  ).toBeVisible();
  await page
    .getByRole('tab', { name: /^(Review|Changes)$/, exact: true })
    .focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('tab', { name: 'Files', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/surface=files/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Review', exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Toggle Sidebar', exact: true }),
  ).toBeInViewport();
  await expect(page.locator('[data-slot="resizable-handle"]')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('selected diff rows match worktree selection in both themes', async ({
  page,
}) => {
  await page.goto('/');
  await connect(page);
  await openNavigation(page);
  const worktree = page.getByRole('button', { name: /^review / });
  await worktree.click();
  const diff = page.getByRole('button', { name: /README\.md.*staged/ }).first();
  const appearance = (element: HTMLElement | SVGElement) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      border: style.borderWidth,
      radius: style.borderRadius,
      shadow: style.boxShadow,
      weight: style.fontWeight,
    };
  };
  for (const theme of ['light', 'dark']) {
    if (await page.getByRole('dialog').isVisible()) {
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await page.evaluate(
      (value) =>
        document.documentElement.classList.toggle('dark', value === 'dark'),
      theme,
    );
    await openNavigation(page);
    await expect(worktree).toHaveAttribute('aria-pressed', 'true');
    const expected = await worktree.evaluate(appearance);
    if (await page.getByRole('dialog').isVisible()) {
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    const trigger = page.getByRole('button', { name: 'Review', exact: true });
    if (await trigger.isVisible()) await trigger.click();
    await diff.click();
    if (await trigger.isVisible()) {
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await trigger.click();
    }
    await expect(diff).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => diff.evaluate(appearance)).toEqual(expected);
  }
});

test('inspects staged changes, commit history and artifact metadata from the real server', async ({
  page,
}) => {
  await page.goto('/');
  await connect(page);
  await openNavigation(page);
  await page.getByRole('button', { name: /^review / }).click();
  const openReview = async () => {
    const trigger = page.getByRole('button', { name: 'Review', exact: true });
    if (await trigger.isVisible()) await trigger.click();
  };
  await openReview();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await expect(page).toHaveURL(/surface=files/);
  const docs = page.getByRole('treeitem', { name: 'docs', exact: true });
  await docs.focus();
  await page.keyboard.press('ArrowRight');
  await expect(docs).toHaveAttribute('aria-expanded', 'true');
  await page
    .getByRole('treeitem', { name: 'review-guide.md', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'docs/review-guide.md' }),
  ).toBeVisible();
  await openReview();
  const reopenedDocs = page.getByRole('treeitem', {
    name: 'docs',
    exact: true,
  });
  await reopenedDocs.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(reopenedDocs).toHaveAttribute('aria-expanded', 'false');
  const assets = page.getByRole('treeitem', { name: 'assets', exact: true });
  const assetsLoaded = page.waitForResponse((response) =>
    response.url().includes('/directory?path=assets'),
  );
  await assets.focus();
  await page.keyboard.press('ArrowRight');
  await expect(assets).toHaveAttribute('aria-expanded', 'true');
  await assetsLoaded;
  await expect(reopenedDocs).toHaveAttribute('aria-expanded', 'false');
  await page
    .getByRole('tab', { name: /^(Review|Changes)$/, exact: true })
    .click();
  await expect(page).toHaveURL(/surface=changes/);
  await page
    .getByRole('button', { name: /README\.md.*staged/ })
    .first()
    .click();
  const diffs = page.getByRole('region', { name: 'Read-only diff' });
  await expect(diffs).toHaveCount(2);
  const code = diffs
    .filter({ hasText: 'Review focus: release readiness.' })
    .first();
  await expect(code).toContainText('Review focus: release readiness.');
  await expect(
    code.locator('[data-line-type="change-addition"]').first(),
  ).toBeVisible();
  await openReview();
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await page
    .getByRole('button', { name: /Document launch board review workflow/ })
    .click();
  await expect(page.getByRole('main')).toContainText('docs/review-guide.md');
  await openReview();
  await page
    .getByRole('tab', { name: /^(Review|Changes)$/, exact: true })
    .click();
  await page.getByRole('button', { name: /The whole handoff/ }).click();
  await page
    .getByTestId('review-document')
    .getByRole('button', { name: /Launch review report/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Launch review report' }),
  ).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Stored artifact');
});
