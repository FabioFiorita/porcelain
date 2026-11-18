import { expect, test } from './fixtures.ts';
import { archiveFixture } from '../kit/archive-fixture.ts';
import { navigatorLabelIsContained } from '../kit/navigator.ts';

for (const width of [1440, 414]) {
  test(`a titled worktree reads as one line inside its card and discloses its branch at ${width}px`, async ({
    pairedPage: page,
    server,
    app,
  }) => {
    const branch =
      'refactor/dtc-redesign-foundation-quality-fixes-with-a-long-branch-name';
    const main = (await server.project()).worktrees.find(
      (worktree) => worktree.main,
    )?.path;
    if (!main) throw new Error('Missing main checkout');
    await archiveFixture(main, { branch });
    await page.setViewportSize({ width, height: 896 });
    await app.reload();
    const toggle = page.getByRole('button', {
      name: 'Toggle Sidebar',
      exact: true,
    });
    if (width === 414) await toggle.click();
    const row = page.getByRole('button', {
      name: new RegExp(`^Completed archive fixture, ${branch}, `),
    });
    const card = page.getByRole('listitem').filter({ has: row });
    const label = card.getByText('Completed archive fixture', { exact: true });
    await expect(card).toHaveText('Completed archive fixture#423 merged');
    await expect(
      card.getByRole('button', { name: /^Open PR #423 · / }),
    ).toBeVisible();
    for (const selected of [false, true]) {
      if (selected) {
        await row.click();
        if (width === 414) await toggle.click();
        await expect(row).toHaveAttribute('aria-current', 'page');
      } else await expect(row).not.toHaveAttribute('aria-current');
      await card.hover();
      await expect
        .poll(() => label.evaluate(navigatorLabelIsContained))
        .toBe(true);
    }
    await row.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(row).toBeFocused();
    await expect(
      page.getByRole('tooltip', {
        name: new RegExp(`^Completed archive fixture · ${branch} · /`),
      }),
    ).toBeVisible();
  });
}
