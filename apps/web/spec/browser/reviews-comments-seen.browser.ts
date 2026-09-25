import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

test('reading the comments clears the agent-replied flag, and a newer agent comment raises it again until it is read', async ({
  pairedPage,
  repo,
  server,
  agent,
}) => {
  const first = 'I added a line to the readme';
  const second = 'I also checked the other files';
  const status = async () => (await server.project()).worktrees[0]?.status;
  const review = pairedPage.getByRole('button', {
    name: 'Review',
    exact: true,
  });
  const comments = pairedPage.getByRole('dialog');

  await agent.comment(repo.readme.path, first);
  await expect.poll(status).toBe('replied');
  await expect.element(pairedPage.getByText(first)).toBeVisible();
  await expect.poll(status).toBe('replied');

  await review.click();
  await pairedPage.getByRole('tab', { name: /^Comments/ }).click();
  await expect.element(comments.getByText(first)).toBeVisible();
  await expect.poll(status).toBeUndefined();
  await userEvent.keyboard('{Escape}');
  await expect.element(comments).not.toBeInTheDocument();

  await agent.comment(repo.readme.path, second);
  await expect.element(pairedPage.getByText(second)).toBeVisible();
  await expect.poll(status).toBe('replied');

  await review.click();
  await pairedPage.getByRole('tab', { name: /^Comments/ }).click();
  await expect.element(comments.getByText(second)).toBeVisible();
  await expect.poll(status).toBeUndefined();
});
