import { page as browserPage } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

const question =
  'Outbox and journal are updated separately. Transaction ownership needs a decision.';

test('a decision connected to a question pins it beside the decision, and its answer quotes the question on the whole change', async ({
  agent,
  render,
  server,
}) => {
  await agent.publishArchitecture();
  const published = (await server.publishedReview()).review;
  if (!published?.reviewId)
    throw new Error('The published fixture has no review');
  const app = await render.route(`/reviews/${published.reviewId}`);
  await app.page
    .getByRole('button', {
      name: '6. Retry delivery without duplicate messages',
      exact: true,
    })
    .click();
  const decision = app.page.getByRole('region', {
    name: '6. Retry delivery without duplicate messages',
    exact: true,
  });
  const details = decision.getByRole('complementary', {
    name: 'Decision details',
    exact: true,
  });
  await expect
    .element(
      details.getByText('Needs your decision · Delivery outbox', {
        exact: true,
      }),
    )
    .toBeVisible();
  await details
    .getByRole('button', { name: 'Answer this question', exact: true })
    .click();
  await details
    .getByRole('textbox', { name: 'Comment', exact: true })
    .fill('Keep one transaction in the outbox owner.');
  await details.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect
    .poll(() => server.reviewComments(published.reviewId ?? ''))
    .toMatchObject([
      {
        anchor: { kind: 'change', revision: published.headOid },
        messages: [
          {
            body: `> ${question}\n\nKeep one transaction in the outbox owner.`,
          },
        ],
      },
    ]);
});

test('the closing page keeps Ready to merge behind every decision and the agent recommending Merge, and marks the files it can from the dock', async ({
  agent,
  render,
  server,
}) => {
  await agent.publishArchitecture();
  const published = (await server.publishedReview()).review;
  if (!published?.reviewId)
    throw new Error('The published fixture has no review');
  const app = await render.route(`/reviews/${published.reviewId}`);
  await app.page
    .getByRole('button', { name: 'Not explained', exact: true })
    .click();
  const completion = app.page.getByRole('region', {
    name: 'Review completion',
    exact: true,
  });
  await expect
    .element(completion.getByRole('heading', { level: 3 }))
    .toHaveTextContent('0 of 9 decisions reviewed');
  await expect
    .element(
      completion.getByRole('region', {
        name: 'Ready to merge needs',
        exact: true,
      }),
    )
    .toHaveTextContent(
      'Ready to merge needsEvery decision reviewedThe agent recommends Merge · r1 says HoldStill needs you',
    );
  const dock = app.page.getByRole('navigation', {
    name: 'Walkthrough dock',
    exact: true,
  });
  await dock
    .getByRole('button', { name: 'Mark 1 file reviewed', exact: true })
    .click();
  await expect
    .element(
      dock.getByRole('button', { name: 'Every file reviewed', exact: true }),
    )
    .toBeDisabled();
  const closing = app.page.getByRole('region', {
    name: 'Not explained',
    exact: true,
  });
  await expect
    .element(
      closing.getByRole('button', {
        name: 'Unmark docs/architecture.md as unreviewed',
        exact: true,
      }),
    )
    .toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () =>
      JSON.stringify(await server.reviewMarks(published.reviewId ?? '')),
    )
    .toContain('"path":"docs/architecture.md"');
});

test('the agent summary lists the decisions its page links to and opens one from the margin', async ({
  agent,
  render,
  server,
}) => {
  await agent.publishArchitecture();
  const published = (await server.publishedReview()).review;
  if (!published?.reviewId)
    throw new Error('The published fixture has no review');
  const app = await render.route(`/reviews/${published.reviewId}`);
  await app.page
    .getByRole('tab', { name: 'Agent summary', exact: true })
    .click();
  await expect
    .element(app.page.getByText('Sandboxed', { exact: true }))
    .toBeVisible();
  const links = app.page.getByRole('region', {
    name: 'Links in this page',
    exact: true,
  });
  await links
    .getByRole('button', {
      name: 'Establish the shared mutation boundary',
      exact: true,
    })
    .click();
  await expect
    .element(
      app.page.getByRole('region', {
        name: '9. Establish the shared mutation boundary',
        exact: true,
      }),
    )
    .toBeVisible();
});

test.for([1440, 900])(
  'threads on neighbouring lines of a decision each stay readable and reachable at %i px',
  { timeout: 30_000 },
  async (width, { agent, render, server, reviewLayout }) => {
    await browserPage.viewport(width, 896);
    try {
      await agent.publishArchitecture();
      const published = (await server.publishedReview()).review;
      if (!published?.reviewId || !published.headOid || !published.base)
        throw new Error('The published fixture has no review');
      const path = 'packages/workspace/src/outbox.ts';
      const bodies = [2, 3, 4, 5, 6].map(
        (line) => `Line ${line} needs a second look before delivery retries.`,
      );
      for (const [index, body] of bodies.entries())
        await agent.comment(path, body, {
          reviewId: published.reviewId,
          reviewRevision: published.revision,
          anchor: {
            kind: 'codeRange',
            filePath: path,
            startLine: index + 2,
            endLine: index + 2,
            side: 'additions',
            revision: published.headOid,
            comparison: { kind: 'branch', base: published.base },
          },
        });
      const app = await render.route(`/reviews/${published.reviewId}`);
      await app.page
        .getByRole('button', {
          name: '9. Establish the shared mutation boundary',
          exact: true,
        })
        .click();
      const decision = app.page.getByRole('region', {
        name: '9. Establish the shared mutation boundary',
        exact: true,
      });
      const outbox = decision.getByRole('button', {
        name: /^Comment on packages\/workspace\/src\/outbox\.ts/,
      });
      await expect.element(outbox).toBeInTheDocument();
      reviewLayout.bringIntoView(outbox);
      const threads = decision.getByRole('article', {
        name: 'Comment thread',
        exact: true,
      });
      for (const body of bodies)
        await expect.element(threads.filter({ hasText: body })).toBeVisible();
      await expect.poll(() => reviewLayout.separate(threads)).toBe(true);
      for (const body of bodies)
        await expect
          .poll(() =>
            reviewLayout.reachable(
              threads
                .filter({ hasText: body })
                .getByRole('button', { name: 'Reply', exact: true }),
            ),
          )
          .toBe(true);
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);

test.for([414, 360])(
  'the dock keeps its primary action whole at %i px',
  async (width, { agent, render, server, reviewLayout }) => {
    await browserPage.viewport(width, 896);
    try {
      await agent.publishArchitecture();
      const published = (await server.publishedReview()).review;
      if (!published?.reviewId)
        throw new Error('The published fixture has no review');
      const app = await render.route(`/reviews/${published.reviewId}`);
      await app.page
        .getByRole('button', { name: 'Not explained', exact: true })
        .click();
      const dock = app.page.getByRole('navigation', {
        name: 'Walkthrough dock',
        exact: true,
      });
      const action = dock.getByRole('button', {
        name: 'Mark 1 file reviewed',
        exact: true,
      });
      await expect.element(action).toBeVisible();
      await expect
        .poll(() => reviewLayout.holds(dock, action))
        .toEqual({ inside: true, fits: true });
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);
