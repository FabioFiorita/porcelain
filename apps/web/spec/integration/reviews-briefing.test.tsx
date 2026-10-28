import { page, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

const question =
  'Outbox and journal are updated separately. Transaction ownership needs a decision.';

test('the briefing owns verdict and proof, and decisions keep their code', async ({
  repo,
  render,
  tabShortcuts,
}) => {
  await page.viewport(1440, 896);
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
      .poll(() => app.location())
      .toBe(`/reviews/${fixture.reviewId}?decision=${fixture.layerId}`);
    await expect
      .element(app.page.getByRole('region', { name: 'Verdict', exact: true }))
      .not.toBeInTheDocument();
    const decision = app.page.getByRole('region', {
      name: '1. Keep immutable decisions',
      exact: true,
    });
    await expect.element(decision).toBeVisible();
    await expect
      .element(
        decision.getByText('export const revision = 1;', { exact: true }),
      )
      .toBeVisible();
    await expect
      .poll(() => tabShortcuts.registered(['P']))
      .toEqual([['P', 'error']]);
    await userEvent.keyboard('p');
    await expect
      .poll(() => app.location())
      .toBe(`/reviews/${fixture.reviewId}`);
    await expect.element(briefing).toBeVisible();
    await briefing
      .getByRole('button', { name: 'Revision 1, the latest', exact: true })
      .click();
    await expect
      .poll(() => app.location())
      .toBe(`/reviews/${fixture.reviewId}`);
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
});

const longRequest = `Keep a very long filename readable: ${'very-long-path-segment-'.repeat(18)}`;

test.for([414, 1080, 1440])(
  'long unbroken briefing prose fits the reading pane at width %s',
  async (width, { repo, render, reviewLayout }) => {
    await page.viewport(width, 896);
    try {
      const prose = `Asked: ${'documentHoldEscalationAcknowledgementWithoutAnyBreakOpportunity'.repeat(8)}`;
      const title =
        'documentHoldEscalationAcknowledgementWithoutAnyBreakOpportunity'.repeat(
          3,
        );
      const path = `${'long-path-segment-'.repeat(12)}.ts`;
      const lane = 'VeryLongUnbrokenClientResponsibility'.repeat(2);
      const fixture = await repo.review(title, prose, { path, lane });
      const app = await render.route(`/reviews/${fixture.reviewId}`);
      const briefing = app.page.getByRole('region', {
        name: 'Briefing',
        exact: true,
      });
      await expect.element(briefing).toBeVisible();
      await expect
        .element(
          briefing.getByRole('region', { name: 'You asked', exact: true }),
        )
        .toMatchTextContent(prose);
      await expect
        .poll(() => reviewLayout.fitsViewport(briefing))
        .toEqual({ insideViewport: true, contentFits: true });
      const row = briefing.getByRole('button', {
        name: new RegExp(`^1\\. ${title}(?: · .*)?$`, 'u'),
      });
      await expect.element(row).toHaveAccessibleName(`1. ${title} · ${lane}`);
      reviewLayout.focus(row);
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}{Tab}');
      await expect.element(row).toHaveFocus();
      await expect
        .element(app.page.getByRole('tooltip'))
        .toHaveTextContent(lane);
      const rendered = app.whenRendered(
        `/reviews/${fixture.reviewId}?decision=${fixture.layerId}`,
      );
      await userEvent.keyboard('{Enter}');
      await rendered;
      const decision = app.page.getByRole('region', {
        name: `1. ${title}`,
        exact: true,
      });
      await expect
        .element(decision.getByRole('heading', { name: title, exact: true }))
        .toBeVisible();
      const route = decision.getByRole('button', {
        name: /^Go to step 1: Read the retained revision/u,
      });
      await expect.element(route).toBeVisible();
      await expect
        .element(route)
        .toHaveAccessibleName(
          `Go to step 1: Read the retained revision · ${lane} · ${path}`,
        );
      reviewLayout.focus(route);
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}{Tab}');
      await expect.element(route).toHaveFocus();
      await expect
        .element(app.page.getByRole('tooltip'))
        .toHaveTextContent(`${lane} · ${path}`);
      await expect
        .poll(() => reviewLayout.fitsViewport(decision))
        .toEqual({ insideViewport: true, contentFits: true });
    } finally {
      await page.viewport(414, 896);
    }
  },
);

test.for([
  { asked: longRequest, clipped: true },
  { asked: 'Retain each review', clipped: false },
])(
  'the briefing bounds its title at 414 and retains the full request: clipped=$clipped',
  async ({ asked, clipped }, { repo, render, reviewLayout }) => {
    await page.viewport(414, 896);
    const fixture = await repo.review('Keep immutable decisions', asked);
    const app = await render.route(`/reviews/${fixture.reviewId}`);
    const briefing = app.page.getByRole('region', {
      name: 'Briefing',
      exact: true,
    });
    const heading = briefing.getByRole('heading', {
      name: `${asked} 1 decision shapes this change.`,
      exact: true,
    });
    await expect.element(heading).toBeVisible();
    const title = heading.getByText(asked, { exact: true });
    await expect
      .poll(() => reviewLayout.titleLines(title))
      .toEqual({ withinThreeLines: true, clipped });
    await expect
      .element(briefing.getByRole('region', { name: 'You asked', exact: true }))
      .toMatchTextContent(`You asked: “${asked}”`);
    if (clipped) {
      reviewLayout.focus(title);
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}{Tab}');
      await expect.element(title).toHaveFocus();
      await expect
        .element(app.page.getByRole('tooltip'))
        .toHaveTextContent(asked);
    } else {
      await expect.element(title).not.toHaveAttribute('tabindex');
      await expect.element(title).not.toHaveAttribute('data-clipped');
    }
  },
);

test('a briefing answer quotes its question, rejects blanks and posts one review-owned whole-change comment', async ({
  agent,
  render,
  server,
  fetchGate,
}) => {
  await agent.publishArchitecture();
  const published = (await server.publishedReview()).review;
  if (!published?.reviewId)
    throw new Error('The published fixture has no review');
  const held = fetchGate.holdNextPost('/comments');
  held.arm();
  const app = await render.route(`/reviews/${published.reviewId}`);
  const briefing = app.page.getByRole('region', {
    name: 'Briefing',
    exact: true,
  });
  await briefing
    .getByRole('button', { name: 'Answer the agent', exact: true })
    .click();
  const textbox = briefing.getByRole('textbox', {
    name: 'Answer the agent',
    exact: true,
  });
  const post = briefing.getByRole('button', {
    name: 'Send answer',
    exact: true,
  });
  await expect.element(post).toBeDisabled();
  await textbox.fill('   ');
  await expect.element(post).toBeDisabled();
  await textbox.fill('Use the session owner transaction.');
  await post.click();
  await held.requested;
  await expect.element(textbox).toBeDisabled();
  await expect
    .element(briefing.getByRole('button', { name: 'Sending…', exact: true }))
    .toBeDisabled();
  held.release();
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
        name: 'Answer the agent',
        exact: true,
      }),
    )
    .toHaveFocus();
});
