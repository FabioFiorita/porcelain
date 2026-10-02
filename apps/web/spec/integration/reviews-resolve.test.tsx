import { expect, test } from './fixtures.tsx';

test('resolving a comment moves it from open to resolved, and reopening it brings it back', async ({
  workspace,
  repo,
  server,
  agent,
}) => {
  const question = 'Is this line still needed?';
  const resolved = async () =>
    (await server.commentThreads()).map((thread) => thread.resolved);

  await agent.comment(repo.readme.path, question);
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: /^Comments/ }).click();
  const comments = workspace.getByRole('dialog');
  await expect
    .element(comments.getByText(question, { exact: true }))
    .toBeVisible();
  await comments.getByRole('button', { name: 'Resolve', exact: true }).click();
  await expect
    .element(comments.getByText('No open comments yet.', { exact: true }))
    .toBeVisible();
  await expect.poll(resolved).toEqual([true]);

  await comments.getByRole('button', { name: /^resolved/i }).click();
  await expect
    .element(comments.getByText(question, { exact: true }))
    .toBeVisible();
  await comments.getByRole('button', { name: 'Reopen', exact: true }).click();
  await expect
    .element(comments.getByText('Nothing resolved yet.', { exact: true }))
    .toBeVisible();
  await expect.poll(resolved).toEqual([false]);
  await comments.getByRole('button', { name: /^open/i }).click();
  await expect
    .element(comments.getByText(question, { exact: true }))
    .toBeVisible();
});
