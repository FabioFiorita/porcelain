import { expect, test } from './fixtures.ts';

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
    if (viewport.width < 1280)
      await sidebar.getByRole('tab', { name: 'Changes', exact: true }).click();
    else
      await page
        .getByRole('navigation', { name: 'Side panel', exact: true })
        .getByRole('button', { name: 'Changes', exact: true })
        .click();
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
