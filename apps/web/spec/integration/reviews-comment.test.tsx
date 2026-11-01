import { userEvent } from 'vitest/browser';
import { expect, expectInputFocus, test } from './fixtures.tsx';

test('the file comment shortcut refocuses an open draft without changing its text', async ({
  workspace,
  repo,
}) => {
  await workspace
    .getByRole('button', {
      name: new RegExp(`^Comment on ${repo.readme.path} \\(`),
    })
    .click();
  const comment = workspace.getByRole('textbox', {
    name: 'Comment',
    exact: true,
  });
  await comment.fill('Keep writing this feedback.');
  await userEvent.tab();
  await userEvent.keyboard('c');
  await expectInputFocus(comment);
  await expect.element(comment).toHaveValue('Keep writing this feedback.');
});

test('a blank comment cannot be posted, and a written comment on a changed file is saved and waits for the agent', async ({
  workspace,
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

  await workspace
    .getByRole('button', { name: new RegExp(`^Comment on ${readme} \\(`) })
    .click();
  const comment = workspace.getByRole('textbox', {
    name: 'Comment',
    exact: true,
  });
  const post = workspace.getByRole('button', { name: 'Comment', exact: true });
  await expect.element(comment).toBeVisible();
  await expect.element(post).toBeDisabled();
  await comment.fill('   ');
  await expect.element(post).toBeDisabled();
  await expect.poll(saved).toEqual([]);

  await comment.fill(body);
  await workspace
    .getByRole('button', { name: new RegExp(`^Comment on ${readme} \\(`) })
    .click();
  await expect.element(comment).toHaveValue(body);
  await workspace
    .getByRole('button', { name: new RegExp(`^Comment on ${readme} \\(`) })
    .click();
  await expect.element(comment).toHaveValue(body);
  await post.click();
  await expect
    .element(workspace.getByText(body, { exact: true }))
    .toBeVisible();
  await expect
    .element(workspace.getByText('Waiting for the agent', { exact: true }))
    .toBeVisible();
  await expect
    .poll(saved)
    .toEqual([{ file: readme, resolved: false, messages: [body] }]);
});

test('the gutter plus keeps an existing draft on the same line and posts its selected anchor once', async ({
  workspace,
  repo,
  server,
}) => {
  const header = workspace.getByRole('button', {
    name: new RegExp(`^Comment on ${repo.readme.path} \\(`),
  });
  await expect.element(header).toBeVisible();
  const open = async () => {
    await workspace.getByText('A change to review.', { exact: true }).hover();
    await workspace
      .getByRole('code')
      .getByRole('button', { name: '', exact: true })
      .click();
  };
  await open();
  const comment = workspace.getByRole('textbox', {
    name: 'Comment',
    exact: true,
  });
  const body = 'Keep this line attached to the original feedback.';
  await comment.fill(body);
  await open();
  await expect.element(comment).toHaveValue(body);
  await userEvent.keyboard('{Control>}{Enter}{/Control}');
  await expect
    .poll(async () =>
      (await server.commentThreads()).map((thread) => ({
        anchor: thread.anchor,
        messages: thread.messages.map((message) => message.body),
      })),
    )
    .toMatchObject([
      {
        anchor: {
          kind: 'codeRange',
          filePath: repo.readme.path,
          startLine: 3,
          endLine: 3,
          side: 'additions',
          comparison: { kind: 'worktree', scope: 'unstaged' },
        },
        messages: [body],
      },
    ]);
});

test('a reply sent with the keyboard survives resolving and reopening its thread', async ({
  workspace,
  repo,
  agent,
  server,
}) => {
  await agent.comment(
    repo.readme.path,
    'The delivery keeps its original identity.',
  );
  const thread = workspace.getByRole('article', {
    name: 'Comment thread',
    exact: true,
  });
  await thread.getByRole('button', { name: 'Reply', exact: true }).click();
  await thread
    .getByRole('textbox', { name: 'Reply', exact: true })
    .fill('Please keep the original identity after reconnecting.');
  await userEvent.keyboard('{Control>}{Enter}{/Control}');
  await expect
    .poll(async () =>
      (await server.commentThreads()).map((entry) => ({
        resolved: entry.resolved,
        messages: entry.messages.map((message) => message.body),
      })),
    )
    .toEqual([
      {
        resolved: false,
        messages: [
          'The delivery keeps its original identity.',
          'Please keep the original identity after reconnecting.',
        ],
      },
    ]);
  await thread.getByRole('button', { name: 'Resolve', exact: true }).click();
  await workspace
    .getByRole('article', { name: 'Resolved comment thread', exact: true })
    .getByRole('button', { name: 'Reopen', exact: true })
    .click();
  await expect
    .poll(async () =>
      (await server.commentThreads()).map((entry) => entry.resolved),
    )
    .toEqual([false]);
  await expect
    .element(
      thread.getByText(
        'Please keep the original identity after reconnecting.',
        {
          exact: true,
        },
      ),
    )
    .toBeVisible();
});

test('a saved comment with a lost response keeps its draft and retry identity after another file-comment click', async ({
  render,
  repo,
  server,
  fetchGate,
}) => {
  fetchGate.loseNextPostResponse('/comments');
  const workspace = await render.workspace();
  const header = workspace.getByRole('button', {
    name: new RegExp(`^Comment on ${repo.readme.path} \\(`),
  });
  await header.click();
  const comment = workspace.getByRole('textbox', {
    name: 'Comment',
    exact: true,
  });
  const post = workspace.getByRole('button', { name: 'Comment', exact: true });
  const body = 'Retry this feedback without posting it twice.';
  await comment.fill(body);
  await post.click();
  await expect.element(workspace.getByRole('alert')).toBeVisible();
  await expect.element(comment).toHaveValue(body);
  const saved = async () =>
    (await server.commentThreads()).map((thread) =>
      thread.messages.map((message) => message.body),
    );
  await expect.poll(saved).toEqual([[body]]);
  await header.click();
  await expect.element(comment).toHaveValue(body);
  await post.click();
  await expect.element(comment).not.toBeInTheDocument();
  await expect.poll(saved).toEqual([[body]]);
});
