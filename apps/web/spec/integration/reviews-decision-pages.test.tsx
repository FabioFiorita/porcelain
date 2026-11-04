import { page as browserPage } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('decision diffs follow the route from the entry point through its owners and proof', async ({
  agent,
  render,
  server,
  reviewLayout,
}) => {
  await agent.publishArchitecture();
  const published = (await server.publishedReview()).review;
  if (!published?.reviewId)
    throw new Error('The published fixture has no review');
  const app = await render.route(`/reviews/${published.reviewId}`);
  await app.page
    .getByRole('button', {
      name: '2. Revoke access across devices · Entry points → Shared client → Server → Owners',
      exact: true,
    })
    .click();
  const decision = app.page.getByRole('region', {
    name: '2. Revoke access across devices',
    exact: true,
  });
  await expect
    .poll(() =>
      reviewLayout.routeSteps(
        decision
          .getByRole('region', {
            name: 'Route through the system',
            exact: true,
          })
          .getByRole('button', { name: /^Go to step /u }),
      ),
    )
    .toEqual([
      { number: '1', current: 'step', weight: '600' },
      { number: '2', current: null, weight: '500' },
      { number: '3', current: null, weight: '500' },
      { number: '4', current: null, weight: '500' },
      { number: '5', current: null, weight: '500' },
      { number: '6', current: null, weight: '500' },
      { number: '7', current: null, weight: '500' },
    ]);
  await expect
    .poll(() =>
      reviewLayout.reviewControlLabels(
        decision.getByRole('checkbox', { name: /^Mark .+ as reviewed$/u }),
      ),
    )
    .toEqual([
      'Mark apps/web/src/revoke-access.ts as reviewed',
      'Mark packages/client/src/revoke-access.ts as reviewed',
      'Mark apps/server/src/revoke-access.ts as reviewed',
      'Mark packages/workspace/src/revoke-access.ts as reviewed',
      'Mark tests/revoke-access.spec.ts as reviewed',
      'Mark docs/decisions/revoke-access.md as reviewed',
    ]);
});

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
      name: /^6\. Retry delivery without duplicate messages · /u,
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
  const card = details.getByRole('region', {
    name: 'Needs your decision: Delivery outbox',
    exact: true,
  });
  await expect.element(card).toBeVisible();
  await card
    .getByRole('textbox', { name: 'Answer the agent', exact: true })
    .fill('Keep one transaction in the outbox owner.');
  await card.getByRole('button', { name: 'Send answer', exact: true }).click();
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

test('the closing page separates reviewed decisions, agent recommendation, proof and remaining files, and marks files from the dock', async ({
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
    .toHaveTextContent('Decisions reviewed');
  await expect
    .element(completion.getByText('2 of 9 decisions', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      completion.getByRole('region', {
        name: 'Agent recommendation',
        exact: true,
      }),
    )
    .toHaveTextContent('Agent recommendationHold · r1');
  await expect
    .element(
      completion.getByRole('region', { name: 'Published proof', exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      completion.getByRole('region', { name: 'Still open', exact: true }),
    )
    .toMatchTextContent('Files left');
  await expect
    .element(completion.getByText('Ready to merge', { exact: true }))
    .not.toBeInTheDocument();
  const dock = app.page.getByRole('navigation', {
    name: 'Walkthrough dock',
    exact: true,
  });
  await dock
    .getByRole('button', { name: 'Mark 2 files reviewed', exact: true })
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
      closing.getByRole('checkbox', {
        name: 'Unmark docs/architecture.md as unreviewed',
        exact: true,
      }),
    )
    .toBeChecked();
  await expect
    .element(
      closing.getByRole('checkbox', {
        name: 'Unmark packages/workspace/src/legacy-write.ts as unreviewed',
        exact: true,
      }),
    )
    .toBeChecked();
  await expect
    .poll(() => server.reviewMarks(published.reviewId ?? ''))
    .toMatchObject({
      files: [
        { path: 'docs/architecture.md' },
        { path: 'packages/workspace/src/legacy-write.ts' },
      ],
    });
});

test('reviewed decisions and a Merge recommendation do not hide failed proof or remaining files', async ({
  repo,
  render,
  server,
}) => {
  await repo.review('Keep the publication owner');
  const fixture = await repo.review('Keep the publication owner');
  const app = await render.route(
    `/reviews/${fixture.reviewId}/2/decisions/${fixture.layerId}`,
  );
  const review = app.page.getByRole('region', {
    name: 'Review walkthrough',
    exact: true,
  });
  await review
    .getByRole('button', { name: 'Mark decision reviewed', exact: true })
    .click();
  await expect
    .element(
      review.getByRole('button', { name: 'Decision reviewed', exact: true }),
    )
    .toHaveAttribute('aria-pressed', 'true');
  await app.navigate(`/reviews/${fixture.reviewId}/2`);
  await review
    .getByRole('button', { name: 'Not explained', exact: true })
    .click();
  const completion = review.getByRole('region', {
    name: 'Review completion',
    exact: true,
  });
  await expect
    .element(completion.getByRole('heading', { level: 3 }))
    .toHaveTextContent('Decisions reviewed');
  await expect
    .element(completion.getByText('1 of 1 decision', { exact: true }))
    .toBeVisible();
  await expect
    .element(completion.getByText('1 of 2 files reviewed', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      completion.getByRole('region', {
        name: 'Agent recommendation',
        exact: true,
      }),
    )
    .toHaveTextContent('Agent recommendationMerge · r2');
  await expect
    .element(
      completion.getByRole('region', { name: 'Published proof', exact: true }),
    )
    .toMatchTextContent('1 passed · 1 failed');
  await expect
    .element(
      completion.getByRole('region', { name: 'Still open', exact: true }),
    )
    .toMatchTextContent('Not explained1 file');
  await expect
    .element(completion.getByText('Ready to merge', { exact: true }))
    .not.toBeInTheDocument();
  await expect
    .poll(() => server.reviewMarks(fixture.reviewId))
    .toMatchObject({
      files: [{ path: 'review-page.ts' }],
      decisions: [{ layerId: fixture.layerId }],
    });
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
  'decision comments remain reachable in retained files at %i px',
  async (width, { agent, render, server, reviewLayout }) => {
    await browserPage.viewport(width, 896);
    try {
      await agent.publishArchitecture();
      const published = (await server.publishedReview()).review;
      if (!published?.reviewId || !published.headOid || !published.base)
        throw new Error('The fixture needs a review');
      const body = 'Keep the delivery boundary in its owner.';
      await agent.comment('packages/workspace/src/outbox.ts', body, {
        reviewId: published.reviewId,
        reviewRevision: published.revision,
        anchor: {
          kind: 'codeRange',
          filePath: 'packages/workspace/src/outbox.ts',
          startLine: 2,
          endLine: 2,
          side: 'additions',
          revision: published.headOid,
          comparison: { kind: 'branch', base: published.base },
        },
      });
      const app = await render.route(`/reviews/${published.reviewId}`);
      await app.page
        .getByRole('button', {
          name: '9. Establish the shared mutation boundary · Shared owners',
          exact: true,
        })
        .click();
      await app.page
        .getByRole('button', {
          name: /^Open packages\/workspace\/src\/outbox\.ts at line [0-9]+$/,
        })
        .click();
      await app.page
        .getByRole('region', { name: 'Code content', exact: true })
        .getByRole('button', { name: /^1 comment · / })
        .click();
      const thread = app.page
        .getByRole('region', { name: 'Code content', exact: true })
        .getByRole('article', { name: 'Comment thread', exact: true })
        .filter({ hasText: body });
      await expect.element(thread).toBeVisible();
      await expect
        .poll(() =>
          reviewLayout.reachable(
            thread.getByRole('button', { name: 'Reply', exact: true }),
          ),
        )
        .toBe(true);
      await expect
        .element(
          app.page.getByRole('button', {
            name: 'Back to the walkthrough',
            exact: true,
          }),
        )
        .toBeVisible();
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);

test('resizing the tab strip preserves the review reading position', async ({
  agent,
  render,
  server,
  reviewLayout,
}) => {
  await browserPage.viewport(1440, 896);
  try {
    await agent.publishArchitecture();
    const published = (await server.publishedReview()).review;
    if (!published?.reviewId) throw new Error('The fixture has no review');
    const app = await render.route(`/reviews/${published.reviewId}`);
    await app.page
      .getByRole('button', { name: 'Toggle Sidebar', exact: true })
      .click();
    await app.page
      .getByRole('button', {
        name: '9. Establish the shared mutation boundary · Shared owners',
        exact: true,
      })
      .click();
    const review = app.page.getByRole('region', {
      name: 'Review walkthrough',
      exact: true,
    });
    const tab = app.page.getByRole('tab', { name: 'Review', exact: true });
    await expect
      .element(
        review.getByRole('button', {
          name: /^Open packages\/workspace\/src\/sessions\.ts at line [0-9]+$/,
        }),
      )
      .toBeInTheDocument();
    reviewLayout.scrollToEnd(review);
    await expect
      .poll(() => reviewLayout.scrollTop(review))
      .toBeGreaterThan(500);
    const before = reviewLayout.scrollTop(review);
    const resized = reviewLayout.tabStripResized(tab);
    await browserPage.viewport(1430, 896);
    await resized;
    await expect
      .poll(() => reviewLayout.scrollTop(review))
      .toBeGreaterThan(before - 1);
  } finally {
    await browserPage.viewport(414, 896);
  }
});

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
      const stop = dock.getByRole('button', {
        name: 'Not explained, jump to a stop',
        exact: true,
      });
      await expect
        .element(stop.getByText('11/11', { exact: true }))
        .toBeVisible();
      await expect
        .poll(() => reviewLayout.holds(dock, stop))
        .toEqual({ inside: true, fits: true });
      const action = dock.getByRole('button', {
        name: 'Mark 2 files reviewed',
        exact: true,
      });
      await expect.element(action).toBeVisible();
      await expect
        .poll(() => reviewLayout.holds(dock, action))
        .toEqual({ inside: true, fits: true });
      await stop.click();
      await app.page
        .getByRole('menuitem', {
          name: '9. Establish the shared mutation boundary',
          exact: true,
        })
        .click();
      const decisionStop = dock.getByRole('button', {
        name: 'Decision 9 of 9, jump to a stop',
        exact: true,
      });
      await expect
        .element(decisionStop.getByText('9/9', { exact: true }))
        .toBeVisible();
      await expect
        .poll(() =>
          reviewLayout.holds(
            dock,
            dock.getByRole('button', {
              name: 'Mark decision reviewed',
              exact: true,
            }),
          ),
        )
        .toEqual({ inside: true, fits: true });
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);

test('in the branch Review tab the completion card counts the open comments the Review panel beside it lists', async ({
  agent,
  render,
  repo,
}) => {
  await agent.publishArchitecture();
  await agent.comment(
    repo.readme.path,
    'Should the readme mention revocation?',
  );
  const workspace = await render.workspace();
  const review = workspace.getByRole('region', {
    name: 'Review walkthrough',
    exact: true,
  });
  await review
    .getByRole('button', { name: 'Continue at decision 3', exact: true })
    .click();
  await review.getByRole('button', { name: /, jump to a stop$/ }).click();
  await workspace
    .getByRole('menuitem', { name: 'Not explained', exact: true })
    .click();
  await expect
    .element(
      review
        .getByRole('region', { name: 'Review completion', exact: true })
        .getByRole('region', { name: 'Still open', exact: true }),
    )
    .toMatchTextContent('Comments2 open');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace
    .getByRole('complementary', { name: 'Review sidebar', exact: true })
    .getByRole('tab', { name: 'Review', exact: true })
    .click();
  const readiness = workspace
    .getByRole('dialog')
    .getByRole('region', { name: 'Readiness', exact: true });
  await expect
    .element(
      readiness.getByRole('button', {
        name: '1 comment waiting on the agent',
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      readiness.getByRole('button', {
        name: '1 comment waiting on you',
        exact: true,
      }),
    )
    .toBeVisible();
});
