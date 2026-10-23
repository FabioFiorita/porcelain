import { page } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

const title =
  'Keep every committed revision readable after the publishing worktree has been removed';

test.for([
  title,
  'Keep packages/reviews/src/services/retainEveryPublishedRevisionAfterThePublishingWorktreeHasBeenRemovedAndNeverLoseItsDecisionHistory.ts readable',
])(
  'the briefing continue button fits a 390 px viewport with a long decision: %s',
  async (decision, { repo, render, reviewLayout }) => {
    await page.viewport(390, 844);
    try {
      const fixture = await repo.review(decision);
      const app = await render.route(`/reviews/${fixture.reviewId}/1`);
      const start = app.page.getByRole('button', {
        name: 'Continue at decision 1',
        exact: true,
      });
      await expect.element(start).toBeVisible();
      await expect
        .poll(() => reviewLayout.fitsViewport(start))
        .toEqual({
          insideViewport: true,
          contentFits: true,
        });
      await start.click();
      await expect
        .poll(() => app.location())
        .toBe(`/reviews/${fixture.reviewId}/1/decisions/${fixture.layerId}`);
    } finally {
      await page.viewport(414, 896);
    }
  },
);

test('the briefing owns the verdict, revisions retain immutable code after checkout removal, and unknown destinations recover', async ({
  repo,
  render,
}) => {
  const first = await repo.review(title);
  const second = await repo.review(`${title} again`);
  await repo.removeReviewWorktree();
  const app = await render.route(`/reviews/${first.reviewId}/1`);
  const review = app.page.getByRole('region', {
    name: 'Review walkthrough',
    exact: true,
  });
  await expect
    .element(
      review.getByRole('heading', {
        name: `Proven at ${first.headOid.slice(0, 7)}`,
        exact: true,
      }),
    )
    .toBeVisible();
  const removed = review.getByRole('region', { name: 'Removed', exact: true });
  await expect
    .element(removed.getByText('− retired.ts', { exact: true }))
    .toBeVisible();
  await expect
    .element(review.getByText('Desktop app', { exact: true }))
    .toBeVisible();
  await expect
    .element(review.getByText(' · Mac is off', { exact: true }))
    .toBeVisible();
  await review
    .getByRole('button', { name: 'Continue at decision 1', exact: true })
    .click();
  await expect
    .poll(() => app.location())
    .toBe(`/reviews/${first.reviewId}/1/decisions/${first.layerId}`);
  const stop = review.getByRole('region', { name: `1. ${title}`, exact: true });
  await expect
    .element(stop.getByRole('heading', { name: title, exact: true }))
    .toBeVisible();
  await expect
    .element(stop.getByText('export const revision = 1;', { exact: true }))
    .toBeVisible();
  await expect
    .element(review.getByRole('region', { name: 'Verdict', exact: true }))
    .not.toBeInTheDocument();
  await review.getByRole('button', { name: /, jump to a stop$/ }).click();
  await app.page
    .getByRole('menuitem', { name: 'Open the briefing', exact: true })
    .click();
  await review.getByRole('button', { name: 'latest', exact: true }).click();
  await expect.poll(() => app.location()).toBe(`/reviews/${first.reviewId}`);
  await expect
    .element(
      review.getByRole('heading', {
        name: `Proven at ${second.headOid.slice(0, 7)}`,
        exact: true,
      }),
    )
    .toBeVisible();
  await app.navigate(`/reviews/${first.reviewId}?decision=${first.layerId}`);
  await expect
    .element(
      review.getByRole('heading', { name: `${title} again`, exact: true }),
    )
    .toBeVisible();
  await app.navigate(`/reviews/${first.reviewId}?decision=unknown`);
  await expect
    .element(review.getByText(/That decision is not in this revision/))
    .toBeVisible();
  await expect
    .element(review.getByRole('region', { name: 'Briefing', exact: true }))
    .toBeVisible();
  await app.navigate(`/reviews/${first.reviewId}/99`);
  await expect
    .element(app.page.getByText('Revision not found', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      app.page.getByRole('button', { name: 'Back to workspace', exact: true }),
    )
    .toBeVisible();
  await app.page
    .getByRole('button', { name: /^Open r\d+, the latest$/ })
    .click();
  await expect
    .element(review.getByRole('region', { name: 'Briefing', exact: true }))
    .toBeVisible();
  await app.navigate('/reviews/00000000-0000-4000-8000-000000000099');
  await expect
    .element(app.page.getByText('Review not found', { exact: true }))
    .toBeVisible();
});

test('an unpaired durable decision link survives pairing with its revision and query intact', async ({
  repo,
  render,
}) => {
  const fixture = await repo.review(title);
  const destination = `/reviews/${fixture.reviewId}/1/decisions/${fixture.layerId}?decision=${fixture.layerId}`;
  const app = await render.route(destination, { unpaired: true });
  await expect
    .element(
      app.page.getByRole('heading', {
        name: 'This browser is not paired',
        exact: true,
      }),
    )
    .toBeVisible();
  await expect.poll(() => app.location()).toBe('/pair');
  await app.pair();
  await expect.poll(() => app.location()).toBe(destination);
  await expect
    .element(app.page.getByRole('region', { name: `1. ${title}`, exact: true }))
    .toBeVisible();
  await expect.poll(() => app.pendingDestination()).toBeNull();
});

test('review-owned marks and comments persist, closing keeps the review readable, and Delete confirms before removing it', async ({
  repo,
  render,
  server,
}) => {
  const fixture = await repo.review(title);
  const app = await render.route(
    `/reviews/${fixture.reviewId}/1/decisions/${fixture.layerId}`,
  );
  const review = app.page.getByRole('region', {
    name: 'Review walkthrough',
    exact: true,
  });
  const stop = review.getByRole('region', { name: `1. ${title}`, exact: true });
  await stop
    .getByRole('button', { name: 'Mark decision reviewed', exact: true })
    .click();
  await expect
    .element(
      stop.getByRole('button', { name: 'Decision reviewed', exact: true }),
    )
    .toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() => server.reviewMarks(fixture.reviewId))
    .toMatchObject({
      decisions: [{ layerId: fixture.layerId }],
      files: [{ path: 'review-page.ts' }],
    });
  await expect
    .poll(() => server.review(fixture.reviewId))
    .toMatchObject({ review: { lastSeenRevision: 1 } });
  await review.getByRole('tab', { name: 'Comments', exact: true }).click();
  await review
    .getByRole('button', { name: 'Comment on this review', exact: true })
    .click();
  await review
    .getByRole('textbox', { name: 'Comment', exact: true })
    .fill('Please retain this explanation across checkout cleanup.');
  await review.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect
    .poll(() => server.reviewComments(fixture.reviewId))
    .toMatchObject([
      {
        review: {
          reviewId: fixture.reviewId,
          revision: 1,
          headOid: fixture.headOid,
        },
        messages: [
          { body: 'Please retain this explanation across checkout cleanup.' },
        ],
      },
    ]);
  await review.getByRole('tab', { name: 'Walkthrough', exact: true }).click();
  await review.getByRole('button', { name: /, jump to a stop$/ }).click();
  await app.page
    .getByRole('menuitem', { name: 'Open the briefing', exact: true })
    .click();
  await review
    .getByRole('button', { name: 'Close review', exact: true })
    .click();
  await expect
    .poll(() => server.review(fixture.reviewId))
    .toMatchObject({ review: { state: 'closed' } });
  await expect
    .element(review.getByText('closed', { exact: true }))
    .toBeVisible();
  await expect
    .element(review.getByRole('button', { name: 'Close review', exact: true }))
    .not.toBeInTheDocument();
  await review
    .getByRole('button', { name: 'Delete review…', exact: true })
    .click();
  const dialog = app.page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect
    .poll(() => server.review(fixture.reviewId))
    .toMatchObject({ review: { state: 'closed' } });
  await review
    .getByRole('button', { name: 'Delete review…', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect
    .element(
      app.page.getByRole('region', { name: 'Review content', exact: true }),
    )
    .toBeVisible();
  await expect.poll(() => server.reviewStatus(fixture.reviewId)).toBe(404);
});

test('durable routes warn when the live branch tip differs from the latest published revision', async ({
  repo,
  render,
}) => {
  const fixture = await repo.review(title);
  await repo.advanceReviewBranch();
  const app = await render.route(`/reviews/${fixture.reviewId}`);
  await expect
    .element(
      app.page.getByText(
        'The branch tip differs from this review. Publish a revision to include it.',
        { exact: true },
      ),
    )
    .toBeVisible();
});

test('stored changed-step excerpts remain readable when the project Git repository is unavailable', async ({
  repo,
  render,
}) => {
  const fixture = await repo.review(title);
  await repo.removeReviewRepository();
  const app = await render.route(
    `/reviews/${fixture.reviewId}/1/decisions/${fixture.layerId}`,
  );
  const excerpt = app.page.getByRole('article', {
    name: 'Step Read the retained revision',
    exact: true,
  });
  await expect
    .element(
      excerpt.getByText(/^export const revision = 1;\nexport const title = /u),
    )
    .toBeVisible();
  await app.page
    .getByRole('button', {
      name: 'Go to step 1: Read the retained revision',
      exact: true,
    })
    .click();
  await expect
    .element(
      app.page.getByText(
        /^review-page\.ts · Code unavailable at this revision$/u,
      ),
    )
    .toBeVisible();
  await expect
    .element(
      excerpt.getByText(/^export const revision = 1;\nexport const title = /u),
    )
    .toBeVisible();
});
