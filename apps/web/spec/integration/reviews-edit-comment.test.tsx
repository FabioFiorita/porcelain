import { expect, test } from './fixtures.tsx';
import { replaceEditorContent } from './commands.ts';

test('the reviewer edits and then deletes their own comment, and cannot change the agent comment', async ({
  workspace,
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
    .element(workspace.getByText(fromAgent, { exact: true }))
    .toBeVisible();
  await expect
    .element(
      workspace.getByRole('button', { name: 'Comment actions', exact: true }),
    )
    .not.toBeInTheDocument();

  await workspace
    .getByRole('button', { name: new RegExp(`^Comment on ${readme} \\(`) })
    .click();
  await workspace
    .getByRole('textbox', { name: 'Comment', exact: true })
    .fill(first);
  await workspace.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect
    .element(workspace.getByText(first, { exact: true }))
    .toBeVisible();

  await workspace
    .getByRole('button', { name: 'Comment actions', exact: true })
    .click();
  await workspace.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const editor = workspace.getByRole('textbox', {
    name: 'Edit comment',
    exact: true,
  });
  await expect.element(editor).toHaveValue(first);
  await replaceEditorContent(editor, '   ');
  await expect
    .element(workspace.getByRole('button', { name: 'Save', exact: true }))
    .toBeDisabled();
  await replaceEditorContent(editor, rewritten);
  await workspace.getByRole('button', { name: 'Save', exact: true }).click();
  await expect
    .element(workspace.getByText(rewritten, { exact: true }))
    .toBeVisible();
  await expect
    .element(workspace.getByText('edited', { exact: true }))
    .toBeVisible();
  await expect
    .poll(saved)
    .toEqual([[`agent: ${fromAgent}`], [`reviewer: ${rewritten}`]]);

  await workspace
    .getByRole('button', { name: 'Comment actions', exact: true })
    .click();
  await workspace
    .getByRole('menuitem', { name: 'Delete', exact: true })
    .click();
  await expect
    .element(workspace.getByText(rewritten, { exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(workspace.getByText(fromAgent, { exact: true }))
    .toBeVisible();
  await expect.poll(saved).toEqual([[`agent: ${fromAgent}`]]);
});
