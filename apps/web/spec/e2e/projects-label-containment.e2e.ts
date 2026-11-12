import { expect, test } from './fixtures.ts';
import { archiveFixture } from '../kit/archive-fixture.ts';
import { navigatorBranchIsContained } from '../kit/navigator.ts';

for (const width of [1440, 414]) {
  test(`titled worktree branches stay inside hovered and selected cards at ${width}px`, async ({
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
      name: new RegExp(`^${branch},`),
    });
    const card = page.getByRole('listitem').filter({ has: row });
    const label = card.getByText(branch, { exact: true });
    await expect(
      card.getByText('Completed archive fixture', { exact: true }),
    ).toBeVisible();
    await expect(label).toBeVisible();
    for (const selected of [false, true]) {
      if (selected) {
        await row.click();
        if (width === 414) await toggle.click();
        await expect(row).toHaveAttribute('aria-current', 'page');
      } else await expect(row).not.toHaveAttribute('aria-current');
      await card.hover();
      await expect
        .poll(() => label.evaluate(navigatorBranchIsContained))
        .toBe(true);
    }
  });
}
