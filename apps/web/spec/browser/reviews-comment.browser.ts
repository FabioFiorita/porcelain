import { expect } from 'vitest';
import { test } from '../kit/journey';

test('a blank comment cannot be posted, and a written comment on a changed file is saved and waits for the agent', async ({
  pairedPage,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const body = 'Please explain this change';
  const saved = async () =>
    (await server.commentThreads()).map((thread) => ({
      file: thread.anchor.filePath,
      resolved: thread.resolved,
      messages: thread.messages.map((message) => message.body),
    }));

  await pairedPage
    .getByRole('button', { name: new RegExp(`^Comment on ${readme} \\(`) })
    .click();
  const comment = pairedPage.getByRole('textbox', { name: 'Comment' });
  const post = pairedPage.getByRole('button', { name: 'Comment', exact: true });
  await expect.element(comment).toBeVisible();
  await expect.element(post).toBeDisabled();
  await comment.fill('   ');
  await expect.element(post).toBeDisabled();
  await expect.poll(saved).toEqual([]);

  await comment.fill(body);
  await post.click();
  await expect.element(pairedPage.getByText(body)).toBeVisible();
  await expect
    .element(pairedPage.getByText('Waiting for the agent'))
    .toBeVisible();
  await expect
    .poll(saved)
    .toEqual([{ file: readme, resolved: false, messages: [body] }]);
});
