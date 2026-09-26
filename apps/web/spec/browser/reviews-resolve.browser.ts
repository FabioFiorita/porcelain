import { expect } from 'vitest';
import { test } from '../kit/journey';

test('resolving a comment moves it from open to resolved, and reopening it brings it back', async ({
  pairedPage,
  repo,
  server,
  agent,
}) => {
  const question = 'Is this line still needed?';
  const resolved = async () =>
    (await server.commentThreads()).map((thread) => thread.resolved);

  await agent.comment(repo.readme.path, question);
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: /^Comments/ }).click();
  const comments = pairedPage.getByRole('dialog');
  await expect.element(comments.getByText(question)).toBeVisible();
  await comments.getByRole('button', { name: 'Resolve' }).click();
  await expect
    .element(comments.getByText('No open comments yet.'))
    .toBeVisible();
  await expect.poll(resolved).toEqual([true]);

  await comments.getByRole('button', { name: /^resolved/i }).click();
  await expect.element(comments.getByText(question)).toBeVisible();
  await comments.getByRole('button', { name: 'Reopen' }).click();
  await expect
    .element(comments.getByText('Nothing resolved yet.'))
    .toBeVisible();
  await expect.poll(resolved).toEqual([false]);
  await comments.getByRole('button', { name: /^open/i }).click();
  await expect.element(comments.getByText(question)).toBeVisible();
});
