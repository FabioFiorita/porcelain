import { expect, test } from './fixtures.tsx';

test('the latest publication stays reachable after the branch advances, with its decisions and proof, and the empty pane reopens it', async ({
  repo,
  agent,
  server,
  render,
}) => {
  await agent.publishProof('Explain the saved change', {
    checks: [{ name: 'Saved review check', result: 'pass' }],
    screenshot: 'Published evidence',
  });
  await repo.write('later.md', 'A later committed change.\n');
  await repo.commit('Advance the branch');
  await expect
    .poll(async () => (await server.publishedReview()).review?.active)
    .toBe(false);
  const workspace = await render.workspace();
  const review = workspace.getByRole('region', {
    name: 'Review walkthrough',
    exact: true,
  });
  await expect
    .element(review.getByRole('heading', { name: 'Saved review', exact: true }))
    .toBeVisible();
  await expect
    .element(review.getByText(/Historical diff replay is unavailable/))
    .toBeVisible();
  await review
    .getByRole('button', {
      name: 'Start with 1. Explain the saved change',
      exact: true,
    })
    .click();
  await expect
    .element(
      review.getByRole('heading', {
        name: 'Explain the saved change',
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      review.getByRole('button', {
        name: 'Go to step 1: New line',
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(review.getByText('A change to review.', { exact: true }))
    .toBeVisible();

  await workspace
    .getByRole('button', { name: 'Close Saved review', exact: true })
    .click();
  await workspace
    .getByRole('button', { name: 'Open saved review', exact: true })
    .click();
  await expect.element(review).toBeVisible();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  const drawer = workspace.getByRole('dialog', {
    name: 'Worktree review',
    exact: true,
  });
  await drawer.getByRole('tab', { name: 'Saved review', exact: true }).click();
  await drawer
    .getByRole('button', { name: 'Saved review', exact: true })
    .click();
  await review.getByRole('button', { name: 'Open proof', exact: true }).click();
  const proof = workspace.getByRole('region', { name: 'Proof', exact: true });
  await expect
    .element(
      proof.getByRole('listitem', {
        name: 'Saved review check: Passed',
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      proof.getByRole('img', { name: 'Published evidence', exact: true }),
    )
    .toBeVisible();
  await workspace
    .getByRole('tab', { name: 'Saved review Close Saved review', exact: true })
    .click();
  await expect.element(review).toBeVisible();
});

test('an active review becomes saved live after an external commit and retains its code after the live file is removed', async ({
  workspace,
  agent,
  repo,
  server,
}) => {
  await agent.publishReview('Keep the decision readable');
  const review = workspace.getByRole('region', {
    name: 'Review walkthrough',
    exact: true,
  });
  await expect
    .element(review.getByRole('heading', { name: 'Review', exact: true }))
    .toBeVisible();
  await expect
    .element(review.getByText(/Historical diff replay is unavailable/))
    .not.toBeInTheDocument();
  await repo.write('later.md', 'An external committed change.\n');
  await repo.commit('Commit externally');
  await expect
    .element(review.getByRole('heading', { name: 'Saved review', exact: true }))
    .toBeVisible();
  await repo.remove(repo.readme.path);
  await expect
    .poll(
      async () =>
        (await server.publishedReview()).review?.layers[0]?.steps[0]?.location
          .state,
    )
    .toBe('current');
  await review
    .getByRole('button', {
      name: 'Start with 1. Keep the decision readable',
      exact: true,
    })
    .click();
  await expect
    .element(review.getByText(/Broken pointer · File no longer exists/))
    .not.toBeInTheDocument();
  await expect
    .element(review.getByText('A line is added', { exact: true }))
    .toBeVisible();
  await expect
    .element(review.getByRole('button', { name: 'Open file', exact: true }))
    .toBeEnabled();
});
