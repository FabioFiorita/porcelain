import { expect, test, type Page } from './fixtures.ts';

type Locator = ReturnType<Page['getByRole']>;
const scrollbarLane = 10;
const panelBorder = 1;

async function checkScrolling(
  page: Page,
  sidebar: Locator,
  control: Locator,
  row: Locator,
) {
  await expect(control).toBeVisible();
  await row.hover();
  const beforeControl = await control.boundingBox();
  const beforeRow = await row.boundingBox();
  if (!beforeControl || !beforeRow)
    throw new Error('The controls and row must be visible.');
  await page.mouse.wheel(0, 300);
  await expect
    .poll(async () => (await row.boundingBox())?.y)
    .toBe(beforeRow.y - 300);
  await expect
    .poll(async () => {
      const header = await control.boundingBox();
      const item = await row.boundingBox();
      const panel = await sidebar.boundingBox();
      if (!header || !item || !panel) return null;
      return {
        headerTop: header.y,
        clearsScrollbar:
          item.x + item.width <=
          panel.x + panel.width - panelBorder - scrollbarLane,
      };
    })
    .toEqual({ headerTop: beforeControl.y, clearsScrollbar: true });
}

test('History keeps the branch and graph header fixed and its rows outside the scrollbar lane', async ({
  app,
  repo,
}) => {
  for (let index = 0; index < 28; index++) {
    await repo.write('history.md', `History ${index}\n`);
    await repo.commit(`Sidebar history ${index}`);
  }
  const page = await app.open(await app.link('this'));
  for (const width of [414, 1440]) {
    await page.setViewportSize({ width, height: 896 });
    if (width === 414)
      await page.getByRole('button', { name: 'Review', exact: true }).click();
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    const sidebar = page.getByRole('complementary', {
      name: 'Review sidebar',
      exact: true,
    });
    await expect(
      sidebar.getByRole('button', { name: 'Open graph', exact: true }),
    ).toBeVisible();
    await checkScrolling(
      page,
      sidebar,
      sidebar.getByRole('button', { name: 'Open graph', exact: true }),
      sidebar.getByRole('button', { name: /^Sidebar history 18 / }),
    );
    if (width === 414) {
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('dialog', { name: 'Worktree review', exact: true }),
      ).not.toBeAttached();
    }
  }
});

test('both Changes lists keep rows outside the scrollbar lane', async ({
  app,
  repo,
}) => {
  await repo.branch('sidebar-scroll');
  await repo.switch('sidebar-scroll');
  for (let index = 0; index < 40; index++)
    await repo.write(
      `sidebar-${String(index).padStart(2, '0')}.md`,
      'Before\n',
    );
  await repo.commit('Add sidebar files');
  for (let index = 0; index < 40; index++)
    await repo.write(`sidebar-${String(index).padStart(2, '0')}.md`, 'After\n');
  const page = await app.open(await app.link('this'));
  for (const width of [414, 1440]) {
    await page.setViewportSize({ width, height: 896 });
    if (width === 414)
      await page.getByRole('button', { name: 'Review', exact: true }).click();
    await page.getByRole('tab', { name: 'Changes', exact: true }).click();
    const sidebar = page.getByRole('complementary', {
      name: 'Review sidebar',
      exact: true,
    });
    for (const scope of ['Uncommitted', 'Branch']) {
      const control = sidebar.getByRole('tab', { name: scope, exact: true });
      await control.click();
      await expect(control).toBeVisible();
      const row = sidebar.getByRole('button', { name: /^sidebar-12.md ·/ });
      await row.hover();
      const before = await row.boundingBox();
      if (!before) throw new Error('The row must be visible.');
      await page.mouse.wheel(0, 300);
      await expect
        .poll(async () => (await row.boundingBox())?.y)
        .toBe(before.y - 300);
      await expect
        .poll(async () => {
          const panel = await sidebar.boundingBox();
          const item = await row.boundingBox();
          if (!panel || !item) return false;
          return (
            item.x + item.width <=
            panel.x + panel.width - panelBorder - scrollbarLane
          );
        })
        .toBe(true);
    }
    if (width === 414) {
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('dialog', { name: 'Worktree review', exact: true }),
      ).not.toBeAttached();
    }
  }
});

for (const viewport of [
  { width: 1300, height: 520 },
  { width: 844, height: 390 },
]) {
  test(`whole-change Comment is reachable by wheel in a ${viewport.width}×${viewport.height} window`, async ({
    app,
    repo,
  }) => {
    await repo.branch('comment-scroll');
    await repo.switch('comment-scroll');
    await repo.write('notes.md', 'Before\n');
    await repo.commit('Add comment fixture');
    await repo.write('notes.md', 'After\n');
    const page = await app.open(await app.link('this'));
    await page.setViewportSize(viewport);
    if (viewport.width < 1280)
      await page.getByRole('button', { name: 'Review', exact: true }).click();
    const sidebar = page.getByRole('complementary', {
      name: 'Review sidebar',
      exact: true,
    });
    await sidebar.getByRole('tab', { name: 'Changes', exact: true }).click();
    await sidebar.getByRole('tab', { name: 'Comments', exact: true }).click();
    await sidebar
      .getByRole('button', {
        name: 'Comment on the whole change',
        exact: true,
      })
      .click();
    const draft = sidebar.getByRole('textbox', {
      name: 'Comment',
      exact: true,
    });
    const text = Array.from({ length: 50 }, (_, index) => `Line ${index}`).join(
      '\n',
    );
    await draft.fill(text);
    const panel = await sidebar.boundingBox();
    if (!panel) throw new Error('The sidebar must be visible.');
    await page.mouse.move(panel.x + 4, panel.y + panel.height / 2);
    await page.mouse.wheel(0, 2000);
    const post = sidebar.getByRole('button', { name: 'Comment', exact: true });
    await expect
      .poll(
        async () => {
          const button = await post.boundingBox();
          return (
            button !== null &&
            button.y >= panel.y &&
            button.y + button.height <= panel.y + panel.height
          );
        },
        {
          message:
            'Wheel scrolling must bring the Comment button inside the sidebar',
        },
      )
      .toBe(true);
    const button = await post.boundingBox();
    if (!button) throw new Error('The Comment button must be visible.');
    await page.mouse.click(
      button.x + button.width / 2,
      button.y + button.height / 2,
    );
    await expect(draft).not.toBeVisible();
    await expect(
      sidebar.getByRole('article', { name: 'Comment thread', exact: true }),
    ).toContainText('Line 49');
    if (viewport.width < 1280) {
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('dialog', { name: 'Worktree review', exact: true }),
      ).not.toBeAttached();
    }
  });
}
