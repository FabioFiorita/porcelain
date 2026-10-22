import { page, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

const question =
  'Outbox and journal are updated separately. Transaction ownership needs a decision.';

test.for([414, 1440])(
  'the briefing owns verdict and proof at width %s, and decisions keep their code',
  async (width, { repo, render }) => {
    await page.viewport(width, 896);
    try {
      const fixture = await repo.review('Keep immutable decisions');
      const app = await render.route(`/reviews/${fixture.reviewId}`);
      const briefing = app.page.getByRole('region', {
        name: 'Briefing',
        exact: true,
      });
      await expect
        .element(
          briefing.getByRole('heading', {
            name: 'Read one committed review after checkout cleanup 1 decision shapes this change.',
            exact: true,
          }),
        )
        .toBeVisible();
      await expect
        .element(briefing.getByRole('region', { name: 'Verdict', exact: true }))
        .toBeVisible();
      await expect
        .element(
          briefing.getByRole('heading', {
            name: 'Recommendation: Hold',
            exact: true,
          }),
        )
        .toBeVisible();
      await expect
        .element(
          briefing
            .getByRole('region', {
              name: `Proven at ${fixture.headOid.slice(0, 7)}`,
              exact: true,
            })
            .getByRole('alert'),
        )
        .toMatchTextContent('1 check failed');
      await expect
        .element(
          briefing.getByRole('listitem', {
            name: 'Negative control: Failed',
            exact: true,
          }),
        )
        .toMatchTextContent('A failing proof check remains visible');
      await expect
        .element(
          briefing.getByRole('complementary', {
            name: 'Review details',
            exact: true,
          }),
        )
        .toBeVisible();
      await briefing
        .getByRole('button', { name: 'Continue at decision 1', exact: true })
        .click();
      await expect
        .element(app.page.getByRole('region', { name: 'Verdict', exact: true }))
        .not.toBeInTheDocument();
      await expect
        .element(
          app.page.getByRole('region', {
            name: '1. Keep immutable decisions',
            exact: true,
          }),
        )
        .toBeVisible();
      await userEvent.keyboard('p');
      await expect.element(briefing).toBeVisible();
      await briefing
        .getByRole('button', { name: 'latest', exact: true })
        .click();
      await repo.review('Keep the next immutable decision');
      await expect
        .element(
          briefing.getByRole('heading', {
            name: 'Recommendation: Merge',
            exact: true,
          }),
        )
        .toBeVisible();
    } finally {
      await page.viewport(414, 896);
    }
  },
);

test('a briefing answer quotes its question, rejects blanks and posts one review-owned whole-change comment', async ({
  agent,
  render,
  server,
}) => {
  await agent.publishArchitecture();
  const published = (await server.publishedReview()).review;
  if (!published?.reviewId)
    throw new Error('The published fixture has no review');
  const originalFetch = window.fetch;
  const requested = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  const attempts: string[] = [];
  window.fetch = async (input, init) => {
    const request = new Request(
      input instanceof Request ? input.clone() : input,
      init,
    );
    if (
      request.method === 'POST' &&
      new URL(request.url).pathname.endsWith('/comments')
    ) {
      attempts.push(await request.clone().text());
      if (attempts.length === 1)
        throw new TypeError('The connection was interrupted');
      requested.resolve();
      await released.promise;
    }
    return originalFetch(input, init);
  };
  try {
    const app = await render.route(`/reviews/${published.reviewId}`);
    const briefing = app.page.getByRole('region', {
      name: 'Briefing',
      exact: true,
    });
    await briefing
      .getByRole('button', { name: 'Answer this question', exact: true })
      .click();
    const textbox = briefing.getByRole('textbox', {
      name: 'Comment',
      exact: true,
    });
    const post = briefing.getByRole('button', { name: 'Comment', exact: true });
    await expect.element(post).toBeDisabled();
    await textbox.fill('   ');
    await expect.element(post).toBeDisabled();
    await textbox.fill('Use the session owner transaction.');
    await post.click();
    await expect.element(briefing.getByRole('alert')).toBeVisible();
    await expect
      .element(textbox)
      .toHaveValue('Use the session owner transaction.');
    await post.click();
    await requested.promise;
    await expect.element(textbox).toBeDisabled();
    await expect
      .element(briefing.getByRole('button', { name: 'Posting…', exact: true }))
      .toBeDisabled();
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(attempts[0]);
    released.resolve();
    await expect
      .poll(() => server.reviewComments(published.reviewId ?? ''))
      .toMatchObject([
        {
          review: {
            reviewId: published.reviewId,
            revision: published.revision,
            headOid: published.headOid,
          },
          anchor: { kind: 'change', revision: published.headOid },
          messages: [
            { body: `> ${question}\n\nUse the session owner transaction.` },
          ],
        },
      ]);
    await expect.element(textbox).not.toBeInTheDocument();
    await expect
      .element(
        briefing.getByRole('button', {
          name: 'Answer this question',
          exact: true,
        }),
      )
      .toHaveFocus();
  } finally {
    released.resolve();
    window.fetch = originalFetch;
  }
});
