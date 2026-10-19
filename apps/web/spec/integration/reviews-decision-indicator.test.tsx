import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test.for(['keyboard', 'toolbar'] as const)(
  'the decision completion indicator follows retained file toggles through %s',
  async (entry, { agent, render, server, repo }) => {
    await agent.publishReview('Readme decision');
    const published = (await server.publishedReview()).review;
    const layerId = published?.layers[0]?.id;
    const workspace = await render.workspace();
    const review = workspace.getByRole('region', {
      name: 'Review walkthrough',
      exact: true,
    });
    await review
      .getByRole('button', { name: '1. Readme decision', exact: true })
      .click();
    const stop = review.getByRole('region', {
      name: '1. Readme decision',
      exact: true,
    });
    await stop
      .getByRole('button', { name: 'Mark decision reviewed', exact: true })
      .click();
    await expect
      .element(stop.getByText('Reviewed', { exact: true }))
      .toBeVisible();
    if (entry === 'keyboard') await userEvent.keyboard('r');
    else
      await stop
        .getByRole('button', {
          name: `Unmark ${repo.readme.path} as unreviewed`,
          exact: true,
        })
        .click();
    await expect
      .poll(() => server.branchReviewMarks())
      .toMatchObject({ files: [], decisions: [{ layerId }] });
    await expect
      .element(stop.getByText('Reviewed', { exact: true }))
      .not.toBeInTheDocument();
    await stop
      .getByRole('button', { name: 'Mark decision reviewed', exact: true })
      .click();
    await expect
      .element(stop.getByText('Reviewed', { exact: true }))
      .toBeVisible();
    await expect
      .poll(() => server.branchReviewMarks())
      .toMatchObject({
        files: [{ path: repo.readme.path }],
        decisions: [{ layerId }],
      });
  },
);
