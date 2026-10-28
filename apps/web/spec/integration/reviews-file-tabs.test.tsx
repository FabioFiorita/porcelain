import { page, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

for (const [width, entry] of [
  [414, 'review page'],
  [1440, 'review page'],
  [414, 'workspace'],
  [1440, 'workspace'],
] as const) {
  const reviewTest = test.extend('openedReview', async ({
    agent,
    render,
    server,
  }, { onCleanup }) => {
    await page.viewport(width, 896);
    onCleanup(() => page.viewport(414, 896));
    await agent.publishArchitecture();
    const publication = (await server.publishedReview()).review;
    if (!publication?.reviewId) throw new Error('The fixture has no review');
    const screen =
      entry === 'workspace'
        ? await render.workspace()
        : (await render.route(`/reviews/${publication.reviewId}`)).page;
    await screen
      .getByRole('button', { name: /^2\. Revoke access across devices ·.+$/ })
      .click();
    const review = screen.getByRole('region', {
      name: 'Review walkthrough',
      exact: true,
    });
    return {
      screen,
      review,
      step: review.getByRole('button', {
        name: /^Go to step 1: Revoke from the device list ·.+$/,
      }),
      tabs: screen.getByRole('tablist', {
        name: 'Open documents',
        exact: true,
      }),
    };
  });

  reviewTest(
    `a stop opens one retained file tab and every way back keeps the decision at ${width} px in the ${entry}`,
    async ({ openedReview: { screen, review, step, tabs }, reviewLayout }) => {
      const path = 'apps/web/src/revoke-access.ts';
      for (const back of ['banner', 'tab', 'previous', 'close'] as const) {
        await step.click();
        const file = tabs.getByRole('tab', { name: path, exact: true });
        await expect.element(file).toHaveAttribute('aria-selected', 'true');
        await expect
          .element(
            screen.getByText(/^Part of the review · Decision 2, stop 1 ·.+$/),
          )
          .toHaveTextContent(
            'Part of the review · Decision 2, stop 1 · Revoke from the device list',
          );
        await expect
          .element(tabs.getByRole('tab', { name: 'Review', exact: true }))
          .toBeVisible();
        await expect.poll(() => reviewLayout.tabInsideStrip(file)).toBe(true);
        if (back === 'banner')
          await screen
            .getByRole('button', {
              name: 'Back to the walkthrough',
              exact: true,
            })
            .click();
        if (back === 'tab')
          await tabs.getByRole('tab', { name: 'Review', exact: true }).click();
        if (back === 'previous')
          await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
        if (back === 'close') await userEvent.keyboard('{Alt>}w{/Alt}');
        await expect
          .element(
            review.getByRole('region', {
              name: '2. Revoke access across devices',
              exact: true,
            }),
          )
          .toBeVisible();
      }
    },
  );

  reviewTest(
    `returning from a retained file keeps the exact walkthrough scroll at ${width} px in the ${entry}`,
    async ({ openedReview: { review, step, tabs }, reviewLayout }) => {
      await step.click();
      await tabs.getByRole('tab', { name: 'Review', exact: true }).click();
      reviewLayout.scrollToEnd(review);
      const before = reviewLayout.scrollTop(review);
      await expect
        .poll(() => reviewLayout.scrollTop(review))
        .toBeGreaterThan(100);
      await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
      await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
      await expect.poll(() => reviewLayout.scrollTop(review)).toBe(before);
    },
  );

  reviewTest(
    `only the focused file pane receives comment shortcuts at ${width} px in the ${entry}`,
    async ({ openedReview: { screen, step } }) => {
      await step.click();
      await userEvent.keyboard('{Alt>}\\{/Alt}');
      const right = screen.getByRole('region', {
        name: 'Right pane',
        exact: true,
      });
      const left = screen.getByRole('region', {
        name: 'Left pane',
        exact: true,
      });
      await expect.element(right).toBeVisible();
      await userEvent.keyboard('c');
      await expect
        .element(right.getByRole('textbox', { name: 'Comment', exact: true }))
        .toBeVisible();
      await expect
        .element(left.getByRole('textbox', { name: 'Comment', exact: true }))
        .not.toBeInTheDocument();
      await right.getByRole('button', { name: 'Cancel', exact: true }).click();
    },
  );
}
