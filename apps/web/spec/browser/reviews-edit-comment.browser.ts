import { expect } from 'vitest';
import { test } from '../kit/journey';

test('the reviewer edits and then deletes their own comment, and cannot change the agent comment', async ({
  pairedPage,
  repo,
  server,
  agent,
}) => {
  const readme = repo.readme.path;
  const first = 'Please explain this change';
  const rewritten = 'Please explain why the heading changed';
  const fromAgent = 'I renamed the heading';
  const saved = async () =>
    (await server.commentThreads()).map((thread) =>
      thread.messages.map((message) => `${message.author}: ${message.body}`),
    );

  await agent.comment(readme, fromAgent);
  await expect
    .element(pairedPage.getByText(fromAgent, { exact: true }))
    .toBeVisible();
  await expect
    .element(
      pairedPage.getByRole('button', { name: 'Comment actions', exact: true }),
    )
    .not.toBeInTheDocument();

  await pairedPage
    .getByRole('button', { name: new RegExp(`^Comment on ${readme} \\(`) })
    .click();
  await pairedPage
    .getByRole('textbox', { name: 'Comment', exact: true })
    .fill(first);
  await pairedPage
    .getByRole('button', { name: 'Comment', exact: true })
    .click();
  await expect
    .element(pairedPage.getByText(first, { exact: true }))
    .toBeVisible();

  await pairedPage
    .getByRole('button', { name: 'Comment actions', exact: true })
    .click();
  await pairedPage.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const editor = pairedPage.getByRole('textbox', {
    name: 'Edit comment',
    exact: true,
  });
  await expect.element(editor).toHaveValue(first);
  await editor.fill('   ');
  await expect
    .element(pairedPage.getByRole('button', { name: 'Save', exact: true }))
    .toBeDisabled();
  await editor.fill(rewritten);
  await pairedPage.getByRole('button', { name: 'Save', exact: true }).click();
  await expect
    .element(pairedPage.getByText(rewritten, { exact: true }))
    .toBeVisible();
  await expect
    .element(pairedPage.getByText('edited', { exact: true }))
    .toBeVisible();
  await expect
    .poll(saved)
    .toEqual([[`agent: ${fromAgent}`], [`reviewer: ${rewritten}`]]);

  await pairedPage
    .getByRole('button', { name: 'Comment actions', exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: 'Delete', exact: true })
    .click();
  await expect
    .element(pairedPage.getByText(rewritten, { exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(pairedPage.getByText(fromAgent, { exact: true }))
    .toBeVisible();
  await expect.poll(saved).toEqual([[`agent: ${fromAgent}`]]);
});
