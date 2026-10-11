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

test('both Changes lists keep their controls fixed and rows outside the scrollbar lane', async ({
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
      await checkScrolling(
        page,
        sidebar,
        control,
        sidebar.getByRole('button', { name: /^sidebar-12.md ·/ }),
      );
    }
    if (width === 414) {
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('dialog', { name: 'Worktree review', exact: true }),
      ).not.toBeAttached();
    }
  }
});

test('sidebar comment drafts keep posting and cancellation visible when the draft is long', async ({
  app,
  repo,
}) => {
  await repo.branch('comment-scroll');
  await repo.switch('comment-scroll');
  await repo.write('notes.md', 'Before\n');
  await repo.commit('Add comment fixture');
  await repo.write('notes.md', 'After\n');
  const page = await app.open(await app.link('this'));
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  const sidebar = page.getByRole('complementary', {
    name: 'Review sidebar',
    exact: true,
  });
  await sidebar.getByRole('tab', { name: 'Changes', exact: true }).click();
  for (const scope of ['Uncommitted', 'Branch']) {
    await sidebar.getByRole('tab', { name: scope, exact: true }).click();
    await sidebar.getByRole('tab', { name: 'Comments', exact: true }).click();
    await sidebar
      .getByRole('button', {
        name:
          scope === 'Branch'
            ? 'Comment on the whole branch'
            : 'Comment on the whole change',
        exact: true,
      })
      .click();
    const draft = sidebar.getByRole('textbox', {
      name: 'Comment',
      exact: true,
    });
    await draft.fill(
      Array.from({ length: 50 }, (_, index) => `Line ${index}`).join('\n'),
    );
    await expect
      .poll(async () => {
        const panel = await sidebar.boundingBox();
        const cancel = await sidebar
          .getByRole('button', { name: 'Cancel', exact: true })
          .boundingBox();
        const post = await sidebar
          .getByRole('button', { name: 'Comment', exact: true })
          .boundingBox();
        if (!panel || !cancel || !post) return false;
        return [cancel, post].every(
          (button) =>
            button.y >= panel.y &&
            button.y + button.height <= panel.y + panel.height,
        );
      })
      .toBe(true);
    await sidebar.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(draft).not.toBeVisible();
  }
});
