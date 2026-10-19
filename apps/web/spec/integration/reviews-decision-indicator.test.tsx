import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test.for(['keyboard', 'toolbar', 'sidebar'] as const)(
  'decision badge, count and controls follow file review toggles through the %s',
  async (entry, { workspace, agent, server, repo }) => {
    await agent.publishReview('Readme decision');
    await repo.write(
      repo.readme.path,
      `${repo.readme.changed}A follow-up edit.\n`,
    );
    await workspace
      .getByRole('button', { name: 'Review', exact: true })
      .click();
    await workspace.getByRole('tab', { name: 'Review', exact: true }).click();
    await workspace.getByRole('button', { name: /Readme decision/ }).click();
    const decision = workspace.getByRole('region', {
      name: '1. Readme decision',
      exact: true,
    });
    const badge = decision.getByText('Reviewed', { exact: true });
    const mark = decision.getByRole('button', {
      name: 'Mark decision reviewed',
      exact: true,
    });
    const reviewed = decision.getByRole('button', {
      name: 'Decision reviewed',
      exact: true,
    });
    const count = workspace.getByRole('navigation', {
      name: 'Walkthrough progress',
      exact: true,
    });
    const files = async () =>
      (await server.reviewedFiles()).marks.map((mark) => mark.path);
    const decisions = async () =>
      (await server.reviewedLayers()).marks.map((mark) => mark.stale);

    await mark.click();
    await expect.element(badge).toBeVisible();
    await expect
      .element(count.getByText('· 1 of 1 decisions', { exact: true }))
      .toBeInTheDocument();
    await expect.poll(files).toEqual([repo.readme.path]);
    await expect.poll(decisions).toEqual([false]);

    await userEvent.keyboard('r');
    await expect.poll(files).toEqual([]);
    await expect.poll(decisions).toEqual([false]);
    await expect
      .element(count.getByText('· 0 of 1 decisions', { exact: true }))
      .toBeInTheDocument();
    await expect.element(badge).not.toBeInTheDocument();
    await expect.element(mark).toHaveAttribute('aria-pressed', 'false');

    if (entry === 'keyboard') await userEvent.keyboard('r');
    else if (entry === 'toolbar') await mark.click();
    else {
      await workspace
        .getByRole('button', { name: 'Review', exact: true })
        .click();
      await workspace
        .getByRole('button', {
          name: 'More actions for decision 1',
          exact: true,
        })
        .click();
      await workspace
        .getByRole('menuitem', { name: 'Mark as reviewed', exact: true })
        .click();
      await userEvent.keyboard('{Escape}');
    }
    await expect.poll(files).toEqual([repo.readme.path]);
    await expect.poll(decisions).toEqual([false]);
    await expect.element(badge).toBeVisible();
    await expect
      .element(count.getByText('· 1 of 1 decisions', { exact: true }))
      .toBeInTheDocument();
    await expect.element(reviewed).toHaveAttribute('aria-pressed', 'true');

    await reviewed.click();
    await expect.poll(decisions).toEqual([]);
    await expect.poll(files).toEqual([repo.readme.path]);
    await expect.element(badge).not.toBeInTheDocument();
    await expect
      .element(count.getByText('· 0 of 1 decisions', { exact: true }))
      .toBeInTheDocument();
  },
);
