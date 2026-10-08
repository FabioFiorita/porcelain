import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('reading the comments clears the agent-replied flag, and a newer agent comment raises it again until it is read', async ({
  workspace,
  repo,
  server,
  agent,
}) => {
  const first = 'I added a line to the readme';
  const second = 'I also checked the other files';
  const status = async () => (await server.project()).worktrees[0]?.status;
  const review = workspace.getByRole('button', {
    name: 'Review',
    exact: true,
  });
  const comments = workspace.getByRole('dialog');

  await agent.comment(repo.readme.path, first);
  await expect.poll(status).toBe('replied');
  await expect
    .element(workspace.getByText(first, { exact: true }))
    .toBeVisible();
  await expect.poll(status).toBe('replied');

  await review.click();
  await workspace.getByRole('tab', { name: 'Changes', exact: true }).click();
  await workspace.getByRole('tab', { name: /^Comments/ }).click();
  await expect
    .element(comments.getByText(first, { exact: true }))
    .toBeVisible();
  await expect.poll(status).toBeUndefined();
  await userEvent.keyboard('{Escape}');
  await expect.element(comments).not.toBeInTheDocument();

  await agent.comment(repo.readme.path, second);
  await expect
    .element(workspace.getByText(second, { exact: true }))
    .toBeVisible();
  await expect.poll(status).toBe('replied');

  await review.click();
  await workspace.getByRole('tab', { name: /^Comments/ }).click();
  await expect
    .element(comments.getByText(second, { exact: true }))
    .toBeVisible();
  await expect.poll(status).toBeUndefined();
});
