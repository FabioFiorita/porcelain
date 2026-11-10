import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('a reply draft returns with its thread after navigating away and posts once', async ({
  agent,
  render,
  repo,
  server,
}) => {
  await agent.comment(repo.readme.path, 'Should reconnect reuse the message?');
  const app = await render.route('/');
  const replyButton = app.page.getByRole('button', {
    name: 'Reply',
    exact: true,
  });
  const reply = app.page.getByRole('textbox', { name: 'Reply', exact: true });
  const body = 'Keep the original message on reconnect.';
  await replyButton.click();
  await reply.fill(body);
  const original = app.location();
  await app.navigate('/settings/general');
  await app.navigate(original);
  await replyButton.click();
  await expect.element(reply).toHaveValue(body);
  await userEvent.keyboard('{Control>}{Enter}{/Control}');
  await expect
    .poll(async () =>
      (await server.commentThreads()).map((thread) =>
        thread.messages.map((message) => message.body),
      ),
    )
    .toEqual([
      [
        'Should reconnect reuse the message?',
        'Keep the original message on reconnect.',
      ],
    ]);
});

test('an edit draft survives navigation and Escape discards it without changing the saved message', async ({
  render,
  repo,
  server,
}) => {
  const app = await render.route('/');
  await app.page
    .getByRole('button', {
      name: new RegExp(`^Comment on ${repo.readme.path} \\(`),
    })
    .click();
  await app.page
    .getByRole('textbox', { name: 'Comment', exact: true })
    .fill('Original feedback');
  await app.page.getByRole('button', { name: 'Comment', exact: true }).click();
  const actions = app.page.getByRole('button', {
    name: 'Comment actions',
    exact: true,
  });
  const edit = async () => {
    await actions.click();
    await app.page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  };
  await edit();
  const editor = app.page.getByRole('textbox', {
    name: 'Edit comment',
    exact: true,
  });
  await editor.fill('Unsent edited feedback');
  const original = app.location();
  await app.navigate('/settings/general');
  await app.navigate(original);
  await edit();
  await expect.element(editor).toHaveValue('Unsent edited feedback');
  await userEvent.keyboard('{Escape}');
  await edit();
  await expect.element(editor).toHaveValue('Original feedback');
  await expect
    .poll(async () =>
      (await server.commentThreads()).map((thread) =>
        thread.messages.map((message) => message.body),
      ),
    )
    .toEqual([['Original feedback']]);
});
