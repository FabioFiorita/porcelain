import { expect, test } from './fixtures.tsx';

test('omitting summary HTML keeps the Agent summary tab hidden on a retained review', async ({
  repo,
  render,
  world,
}) => {
  const fixture = await repo.review('A review without optional HTML');
  await repo.removeReviewWorktree();
  const app = await render.route(`/reviews/${fixture.reviewId}`);
  const tabs = app.page.getByRole('tablist', {
    name: 'Review presentation',
    exact: true,
  });
  await expect
    .element(
      app.page.getByRole('region', { name: 'Review walkthrough', exact: true }),
    )
    .toBeVisible();
  await expect
    .poll(async () =>
      (await world.porcelainHits('this')).some(
        (hit) => hit.route === '/review-summaries/:token' && hit.status === 200,
      ),
    )
    .toBe(true);
  await expect.element(tabs).not.toBeInTheDocument();
  await expect
    .element(app.page.getByRole('tab', { name: 'Agent summary', exact: true }))
    .not.toBeInTheDocument();
});

for (const summary of [
  { name: 'whitespace-only', html: ' \n\t ', visible: false },
  {
    name: 'authored',
    html: '<!doctype html><style>body{font:16px system-ui}</style><h1>Extra context</h1>',
    visible: true,
  },
]) {
  test(`${summary.name} HTML ${summary.visible ? 'offers' : 'hides'} the Agent summary tab`, async ({
    agent,
    render,
    world,
  }) => {
    await agent.publishReview('Optional summary', 'changed', summary.html);
    const workspace = await render.workspace();
    const review = workspace.getByRole('region', {
      name: 'Review walkthrough',
      exact: true,
    });
    await expect.element(review).toBeVisible();
    await expect
      .poll(async () =>
        (await world.porcelainHits('this')).some(
          (hit) =>
            hit.route === '/review-summaries/:token' && hit.status === 200,
        ),
      )
      .toBe(true);
    const tabs = workspace.getByRole('tablist', {
      name: 'Review presentation',
      exact: true,
    });
    const tab = workspace.getByRole('tab', {
      name: 'Agent summary',
      exact: true,
    });
    if (summary.visible) {
      await expect.element(tabs).toHaveAttribute('aria-busy', 'false');
      await tab.click();
      await expect.element(tab).toHaveAttribute('aria-selected', 'true');
    } else {
      await expect.element(tabs).not.toBeInTheDocument();
      await expect.element(tab).not.toBeInTheDocument();
    }
  });
}

test('an Agent summary opened after its signed link expired loads through a fresh link', async ({
  agent,
  render,
  world,
}) => {
  await agent.publishReview(
    'Expiring summary',
    'changed',
    '<!doctype html><h1>Extra context</h1>',
  );
  const workspace = await render.workspace();
  const tabs = workspace.getByRole('tablist', {
    name: 'Review presentation',
    exact: true,
  });
  await expect.element(tabs).toHaveAttribute('aria-busy', 'false');
  const summaryHits = async () =>
    (await world.porcelainHits('this')).filter(
      (hit) => hit.route === '/review-summaries/:token',
    );
  const issued = Date.now();
  await expect
    .poll(() => Date.now() - issued, { timeout: 5_000, interval: 250 })
    .toBeGreaterThan(2_500);
  const before = (await summaryHits()).length;
  await workspace
    .getByRole('tab', { name: 'Agent summary', exact: true })
    .click();
  const frame = workspace.getByTitle('Review summary', { exact: true });
  await expect.element(frame).toBeVisible();
  const expires = Date.parse(
    new URL(frame.element().getAttribute('src') ?? '').searchParams.get(
      'expires',
    ) ?? '',
  );
  expect(expires).toBeGreaterThan(issued + 2_500);
  await expect
    .poll(async () =>
      (await summaryHits()).slice(before).map((hit) => hit.status),
    )
    .toContain(200);
  expect(
    (await summaryHits()).slice(before).map((hit) => hit.status),
  ).not.toContain(404);
});
