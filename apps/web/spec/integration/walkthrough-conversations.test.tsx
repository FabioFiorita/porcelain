import { page as browserPage, userEvent } from 'vitest/browser';
import { expect, test, conversationFixture } from './fixtures.tsx';

const reply =
  'Keep the retry beside its owner. The local boundary is deliberate.';

test('asks, preserves a draft through an answer, saves two, and posts them together once', async ({
  render,
}) => {
  await conversationFixture('pr');
  await browserPage.viewport(1280, 896);
  const { page } = await render.route('/');
  const composer = page.getByRole('textbox', {
    name: 'Decide, or ask about this',
    exact: true,
  });
  await composer.fill('  Keep this boundary.  ');
  await userEvent.keyboard('{Enter}');
  await composer.fill('An unfinished thought');
  await expect
    .element(page.getByText(reply, { exact: true }).first())
    .toBeVisible();
  await expect.element(composer).toHaveValue('An unfinished thought');
  await page
    .getByRole('button', { name: 'Save for later', exact: true })
    .first()
    .click();
  await expect
    .element(page.getByText('1 comment saved', { exact: true }))
    .toBeVisible();
  await page
    .getByRole('button', { name: 'Ask about this', exact: true })
    .last()
    .click();
  const step = page
    .getByRole('textbox', { name: 'Ask about this step', exact: true })
    .last();
  await step.fill('Handle failures here.');
  await userEvent.keyboard('{Enter}');
  await expect
    .element(page.getByText(reply, { exact: true }).last())
    .toBeVisible();
  await page
    .getByRole('button', { name: 'Save for later', exact: true })
    .last()
    .click();
  await expect
    .element(page.getByText('2 comments saved', { exact: true }))
    .toBeVisible();
  await page
    .getByRole('button', { name: 'Post together on #423', exact: true })
    .dblClick();
  await expect
    .element(
      page.getByRole('link', { name: 'Posted on #423', exact: true }).first(),
    )
    .toBeVisible();
  const posts = () => conversationFixture('posts');
  await expect
    .poll(async () => (await posts()).trim().split('\n'))
    .toHaveLength(1);
  await expect.poll(posts).toContain('Keep this boundary.');
  await expect.poll(posts).toContain('Handle failures here.');
  await expect.poll(posts).toContain('Keep the retry beside its owner.');
  await conversationFixture('moved');
  await composer.fill('Keep the boundary explicit.');
  await userEvent.keyboard('{Enter}');
  await page
    .getByRole('button', { name: 'Post on #423', exact: true })
    .first()
    .click();
  await expect
    .element(
      page
        .getByRole('status')
        .filter({ hasText: 'Nothing was posted. Copy the brief instead.' }),
    )
    .toBeVisible();
  await page.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect
    .element(page.getByText('Copied brief', { exact: true }))
    .toBeVisible();
  await expect
    .poll(async () => (await posts()).trim().split('\n'))
    .toHaveLength(1);
});

test('a failed answer can be retried and a walkthrough without a PR copies its brief', async ({
  render,
}) => {
  await conversationFixture('no-pr');
  await conversationFixture('fail');
  const { page } = await render.route('/');
  const composer = page.getByRole('textbox', {
    name: 'Decide, or ask about this',
    exact: true,
  });
  await composer.fill('Why here?');
  await userEvent.keyboard('{Enter}');
  await expect
    .element(
      page
        .getByText(
          'The selected agent CLI stopped before answering. Ask again.',
          { exact: true },
        )
        .first(),
    )
    .toBeVisible();
  await conversationFixture('recover');
  await page
    .getByRole('button', { name: 'Try again', exact: true })
    .first()
    .click();
  await expect
    .element(page.getByText(reply, { exact: true }).first())
    .toBeVisible();
  await page
    .getByRole('button', { name: 'Copy as prompt', exact: true })
    .first()
    .click();
  await expect
    .element(page.getByText('Copied brief', { exact: true }))
    .toBeVisible();
  await expect.poll(() => conversationFixture('posts')).toBe('');
});
