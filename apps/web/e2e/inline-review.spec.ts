import { expect, test } from '@playwright/test';
import { pairBrowser } from './playground';
import { openNavigation } from './workspace-navigation';

test('posts a line comment on the exact comparison, reloads it, and reveals it from the sidebar', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto('/');
  await pairBrowser(page);
  await openNavigation(page);
  await page.getByRole('button', { name: /^review / }).click();
  await page.getByRole('button', { name: /^accessibility.md/ }).click();
  await expect(
    page.getByRole('heading', { name: 'accessibility.md', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('diff-header.png') });
  // The heading arrives with the change; the diff itself is a second read, and
  // hovering a row while the body is still arriving moves it out from under
  // the pointer. Wait for the line being commented on to actually be there.
  const line = page.locator('[data-column-number]').first();
  await expect(page.getByText('# Accessibility review')).toBeVisible();
  await expect(line).toBeVisible();
  await line.hover();
  const utility = page.locator('[data-utility-button]').first();
  await expect(utility).toBeVisible();
  await utility.click();
  const body = `Please clarify this line ${test.info().project.name}`;
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill(body);
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/comments'),
  );
  await page
    .locator('form')
    .filter({
      has: page.getByRole('textbox', { name: 'Comment', exact: true }),
    })
    .getByRole('button', { name: 'Comment', exact: true })
    .click();
  const response = await saved;
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        anchor: expect.objectContaining({
          filePath: 'docs/accessibility.md',
          kind: 'codeRange',
          startLine: 1,
          endLine: 1,
          side: 'additions',
          comparison: { kind: 'worktree', scope: 'staged' },
          contentFingerprint: expect.any(String),
        }),
      }),
    ]),
  );
  await expect(
    page.getByRole('textbox', { name: 'Comment', exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Comments/ }).click();
  const thread = page
    .getByRole('article', { name: 'Comment thread' })
    .filter({ hasText: body });
  // The sidebar cards have a reveal action; the inline copy does not.
  await thread.getByTitle('Show in the code').click();
  await expect(page.getByText(body, { exact: true }).first()).toBeVisible();
  await page.keyboard.press('c');
  await expect(
    page.getByRole('textbox', { name: 'Comment', exact: true }),
  ).toBeFocused();
  await page.keyboard.type('jkr');
  await expect(
    page.getByRole('textbox', { name: 'Comment', exact: true }),
  ).toHaveValue('jkr');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('textbox', { name: 'Comment', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('tab', { name: 'Layers', exact: true }).click();
  await page.getByRole('button', { name: /board-preview.png/ }).click();
  await page
    .getByRole('button', {
      name: /Comment on .*board-preview.png/,
      exact: true,
    })
    .click();
  await page
    .getByRole('textbox', { name: 'Comment', exact: true })
    .fill('Binary file discussion');
  await page
    .locator('form')
    .filter({
      has: page.getByRole('textbox', { name: 'Comment', exact: true }),
    })
    .getByRole('button', { name: 'Comment', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Comment', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Binary file discussion', { exact: true }),
  ).toBeVisible();
});

test('recovers a saved comment whose first response is lost without duplicating it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto('/');
  await pairBrowser(page);
  await openNavigation(page);
  await page.getByRole('button', { name: /^review / }).click();
  await page.getByRole('button', { name: /^accessibility.md/ }).click();
  await expect(page.getByText('# Accessibility review')).toBeVisible();

  const submitted: unknown[] = [];
  let commentsPath = '';
  await page.route('**/api/worktrees/*/comments', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    submitted.push(route.request().postDataJSON());
    commentsPath = new URL(route.request().url()).pathname;
    if (submitted.length === 1) {
      const saved = await route.fetch();
      expect(saved.ok()).toBe(true);
      await route.abort('failed');
      return;
    }
    await route.continue();
  });

  // This case exercises retry identity. The preceding case covers line anchors;
  // use the stable file composer here instead of a hover beside its saved thread.
  await page
    .getByRole('button', {
      name: 'Comment on docs/accessibility.md (staged · added)',
      exact: true,
    })
    .click();
  const body = `Lost response ${test.info().project.name}`;
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill(body);
  await page
    .locator('form')
    .filter({
      has: page.getByRole('textbox', { name: 'Comment', exact: true }),
    })
    .getByRole('button', { name: 'Comment', exact: true })
    .click();

  await expect(
    page.getByRole('textbox', { name: 'Comment', exact: true }),
  ).toHaveCount(0);
  expect(submitted).toHaveLength(2);
  expect(submitted[1]).toEqual(submitted[0]);
  const discussion = await page.request.get(commentsPath);
  expect(discussion.ok()).toBe(true);
  const matching = (await discussion.json()).flatMap(
    (thread: { messages: Array<{ body: string }> }) =>
      thread.messages.filter((message) => message.body === body),
  );
  expect(matching).toHaveLength(1);
  await expect(page.getByText(body, { exact: true })).toBeVisible();
});
