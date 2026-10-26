import { expect, test } from './fixtures.tsx';

for (const surface of ['worktree', 'durable'] as const) {
  test(`${surface} review keeps one pane bar and proof in the briefing`, async ({
    agent,
    repo,
    render,
  }) => {
    let workspace;
    if (surface === 'durable') {
      const review = await repo.review('Keep the reading page below one bar');
      workspace = (await render.route(`/reviews/${review.reviewId}/1`)).page;
    } else {
      await agent.publishProof('Keep the reading page below one bar', {
        checks: [{ name: 'Save journey', result: 'fail' }],
        screenshot: 'Saved notice',
      });
      workspace = await render.workspace();
    }
    const review = workspace.getByRole('region', {
      name: 'Review walkthrough',
      exact: true,
    });
    await expect.element(review).toBeVisible();
    await expect
      .element(workspace.getByRole('tab', { name: 'Review', exact: true }))
      .toBeVisible();
    await expect
      .element(
        workspace.getByRole('tablist', {
          name: 'Review details',
          exact: true,
        }),
      )
      .not.toBeInTheDocument();
    await expect
      .element(review.getByRole('button', { name: 'Back', exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(review.getByRole('heading', { name: /^Proven at / }))
      .toBeVisible();
    await expect
      .element(workspace.getByRole('tab', { name: 'Proof', exact: true }))
      .not.toBeInTheDocument();
  });
}
