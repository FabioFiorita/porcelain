import { page } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('a standalone review includes live worktree comments once and keeps its own discussion after checkout removal', async ({
  repo,
  agent,
  render,
  server,
}) => {
  const app = await render.route('/');
  const workspace = app.page;
  const pending = 'Explain this checkout change before merging.';
  const retained = 'Keep this discussion with the review.';
  await workspace
    .getByRole('button', {
      name: new RegExp(`^Comment on ${repo.readme.path} \\(`),
    })
    .click();
  await workspace
    .getByRole('textbox', { name: 'Comment', exact: true })
    .fill(pending);
  await workspace.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect
    .poll(() => server.commentThreads())
    .toMatchObject([{ messages: [{ body: pending }] }]);
  await agent.publishReview('Include the checkout discussion');
  const published = (await server.publishedReview()).review;
  if (!published?.reviewId) throw new Error('Expected a published review');
  const path = `/reviews/${published.reviewId}`;
  await page.viewport(1440, 900);
  try {
    await app.navigate(path);
    const panel = app.page.getByRole('complementary', {
      name: 'Review sidebar',
      exact: true,
    });
    const readiness = panel.getByRole('region', {
      name: 'Readiness',
      exact: true,
    });
    await expect
      .element(readiness)
      .toMatchTextContent('Comments1 awaiting agent');
    await panel.getByRole('tab', { name: /^Comments/ }).click();
    await expect
      .element(panel.getByText(pending, { exact: true }))
      .toBeVisible();
    await panel
      .getByRole('button', { name: 'Comment on the whole branch', exact: true })
      .click();
    await panel
      .getByRole('textbox', { name: 'Comment', exact: true })
      .fill(retained);
    await panel.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect
      .poll(() => server.reviewComments(published.reviewId ?? ''))
      .toMatchObject([{ messages: [{ body: retained }] }]);
    await expect
      .element(readiness)
      .toMatchTextContent('Comments2 awaiting agent');
    await expect
      .element(panel.getByText(retained, { exact: true }))
      .toBeVisible();
    const checkoutThread = panel
      .getByRole('article', { name: 'Comment thread', exact: true })
      .filter({ hasText: pending });
    await checkoutThread
      .getByRole('button', { name: 'Reply', exact: true })
      .click();
    await checkoutThread
      .getByRole('textbox', { name: 'Reply', exact: true })
      .fill('Please keep the original request.');
    await checkoutThread
      .getByRole('button', { name: 'Post reply', exact: true })
      .click();
    await expect
      .poll(() => server.commentThreads())
      .toMatchObject([
        {
          messages: [
            { body: pending },
            { body: 'Please keep the original request.' },
          ],
        },
        { messages: [{ body: retained }] },
      ]);
    await panel
      .getByRole('article', { name: 'Comment thread', exact: true })
      .filter({ hasText: 'Please keep the original request.' })
      .getByRole('button', { name: 'Resolve', exact: true })
      .click();
    await expect
      .element(readiness)
      .toMatchTextContent('Comments1 awaiting agent');
    await panel.getByRole('button', { name: /^resolved/i }).click();
    await panel
      .getByRole('button', { name: 'Delete resolved', exact: true })
      .click();
    await app.page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect
      .poll(() => server.commentThreads())
      .toMatchObject([{ messages: [{ body: retained }] }]);
    await panel.getByRole('button', { name: /^open /i }).click();
    await repo.removeReviewRepository();
    await app.navigate(path);
    await expect
      .element(readiness)
      .toMatchTextContent('Comments1 awaiting agent');
    await expect
      .element(panel.getByText(retained, { exact: true }))
      .toBeVisible();
    await expect
      .element(panel.getByText(pending, { exact: true }))
      .not.toBeInTheDocument();
  } finally {
    await page.viewport(414, 896);
  }
});
