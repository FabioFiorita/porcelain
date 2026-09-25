import { expect } from 'vitest';
import { test } from '../kit/journey';

test('a blank reply cannot be posted, and a written reply to the agent joins its thread and waits for the agent', async ({
  pairedPage,
  repo,
  server,
  agent,
}) => {
  const question = 'Should this line stay?';
  const answer = 'Yes, it documents the change';
  const conversation = async () =>
    (await server.commentThreads()).map((thread) =>
      thread.messages.map((message) => `${message.author}: ${message.body}`),
    );

  await agent.comment(repo.readme.path, question);
  await expect.element(pairedPage.getByText(question)).toBeVisible();
  await pairedPage.getByRole('button', { name: 'Reply', exact: true }).click();
  const reply = pairedPage.getByRole('textbox', { name: 'Reply' });
  const post = pairedPage.getByRole('button', { name: 'Post reply' });
  await expect.element(reply).toBeVisible();
  await expect.element(post).toBeDisabled();
  await reply.fill('   ');
  await expect.element(post).toBeDisabled();
  await expect.poll(conversation).toEqual([[`agent: ${question}`]]);

  await reply.fill(answer);
  await post.click();
  await expect.element(pairedPage.getByText(answer)).toBeVisible();
  await expect
    .element(pairedPage.getByText('Waiting for the agent'))
    .toBeVisible();
  await expect
    .poll(conversation)
    .toEqual([[`agent: ${question}`, `reviewer: ${answer}`]]);
});
