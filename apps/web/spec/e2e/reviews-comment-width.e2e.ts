import { expect, test } from './fixtures.ts';

declare const window: { getSelection(): { toString(): string } | null };

test('comment text stays selectable and long filenames, waiting badges and actions fit the resizable sidebar and review sheet', async ({
  app,
  repo,
  agent,
  page,
}, info) => {
  const path =
    'phone-otp-with-an-extremely-long-file-name-that-must-not-push-actions-outside-the-review-sidebar.ts';
  await repo.write(path, 'export const retries = 11;\n');
  await agent.comment(path, 'should be 5');
  await page.setViewportSize({ width: 1440, height: 896 });
  await app.open(await app.link('this'));
  const sidebar = page.getByRole('complementary', {
    name: 'Review sidebar',
    exact: true,
  });
  await page
    .getByRole('navigation', { name: 'Side panel', exact: true })
    .getByRole('button', { name: 'Changes', exact: true })
    .click();
  await sidebar.getByRole('tab', { name: /^Comments/ }).click();
  const thread = sidebar.getByRole('article', {
    name: 'Comment thread',
    exact: true,
  });
  await thread.getByText('should be 5', { exact: true }).dblclick();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe('should');
  await page
    .getByRole('region', { name: 'Review content', exact: true })
    .getByText('should be 5', { exact: true })
    .dblclick();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe('should');
  await thread.getByRole('button', { name: 'Reply', exact: true }).click();
  await sidebar
    .getByRole('textbox', { name: 'Reply', exact: true })
    .fill('Please update it');
  await sidebar
    .getByRole('button', { name: 'Post reply', exact: true })
    .click();
  await expect(
    thread.getByText('Waiting for the agent', { exact: true }),
  ).toBeVisible();
  const fits = async () => {
    const article = sidebar.getByRole('article');
    const card = await article.boundingBox();
    if (!card) throw new Error('The comment card must be visible');
    const controls = await article.getByRole('button').all();
    const waiting = article.getByText('Waiting for the agent', { exact: true });
    if (await waiting.count()) controls.push(waiting);
    for (const control of controls) {
      const rect = await control.boundingBox();
      if (!rect || rect.x < card.x || rect.x + rect.width > card.x + card.width)
        return false;
    }
    return true;
  };
  for (const width of [520, 400, 320, 280, 260]) {
    const panel = await sidebar.boundingBox();
    const separator = await page.getByRole('separator').last().boundingBox();
    if (!panel || !separator)
      throw new Error('The sidebar must have a resize handle');
    await page.mouse.move(
      separator.x + separator.width / 2,
      separator.y + separator.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      panel.x + panel.width - width - separator.width / 2,
      separator.y + separator.height / 2,
    );
    await page.mouse.up();
    await expect
      .poll(async () => Math.round((await sidebar.boundingBox())?.width ?? 0))
      .toBe(width);
    await expect
      .poll(fits, { message: `Every comment action must fit at ${width}px` })
      .toBe(true);
    if (width === 260)
      await page.screenshot({ path: info.outputPath('comment-260.png') });
  }
  await thread.getByRole('button', { name: 'Resolve', exact: true }).click();
  await sidebar.getByRole('button', { name: /^resolved/i }).click();
  await expect(
    sidebar.getByRole('article', {
      name: 'Resolved comment thread',
      exact: true,
    }),
  ).toBeVisible();
  await expect.poll(fits).toBe(true);
  await sidebar.getByRole('button', { name: 'Reopen', exact: true }).click();
  await sidebar.getByRole('button', { name: /^open/i }).click();
  await page.setViewportSize({ width: 414, height: 896 });
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await sidebar.getByRole('tab', { name: /^Comments/ }).click();
  await expect(
    thread.getByText('Waiting for the agent', { exact: true }),
  ).toBeVisible();
  await expect.poll(fits).toBe(true);
});
