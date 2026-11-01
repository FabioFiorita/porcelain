import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('different questions with identical wording keep separate answer drafts', async ({
  agent,
  render,
  server,
}) => {
  const question = 'Which owner should make this transaction?';
  await agent.publishArchitecture({
    'Workspace policy': question,
    'Delivery outbox': question,
  });
  const current = (await server.publishedReview()).review;
  if (!current?.reviewId)
    throw new Error('The fixture needs its question review.');
  const app = await render.route(`/reviews/${current.reviewId}`);
  const briefing = app.page.getByRole('region', {
    name: 'Briefing',
    exact: true,
  });
  const answer = briefing.getByRole('button', {
    name: 'Answer the agent',
    exact: true,
  });
  const text = briefing.getByRole('textbox', {
    name: 'Answer the agent',
    exact: true,
  });
  await answer.nth(0).click();
  await text.nth(0).fill('Keep the first answer separate.');
  await answer.nth(1).click();
  await expect.element(text.nth(1)).toHaveValue('');
  await text.nth(1).fill('A different answer for the other owner.');
  await briefing
    .getByRole('button', { name: 'Cancel', exact: true })
    .nth(1)
    .click();
  await expect.element(text).toHaveValue('Keep the first answer separate.');
  await briefing
    .getByRole('button', { name: 'Send answer', exact: true })
    .click();
  await expect
    .poll(() => server.reviewComments(current.reviewId ?? ''))
    .toMatchObject([
      {
        anchor: { kind: 'change', revision: current.headOid },
        messages: [
          { body: `> ${question}\n\nKeep the first answer separate.` },
        ],
      },
    ]);
});

test('a delayed send confirmation leaves another file draft open', async ({
  agent,
  render,
  server,
  fetchGate,
}) => {
  await agent.publishArchitecture();
  const published = (await server.publishedReview()).review;
  const decision = published?.layers.find(
    (layer) => layer.title === 'Schedule reminders durably',
  );
  if (!published?.reviewId || !decision)
    throw new Error('The fixture needs its reminder decision.');
  const held = fetchGate.holdNextPost('/comments');
  held.arm();
  const app = await render.route(
    `/reviews/${published.reviewId}?decision=${decision.id}`,
  );
  const serverHeader = app.page.getByRole('button', {
    name: 'Comment on apps/server/src/schedule-reminder.ts (modified)',
    exact: true,
  });
  const webHeader = app.page.getByRole('button', {
    name: 'Comment on apps/web/src/schedule-reminder.ts (modified)',
    exact: true,
  });
  const comment = app.page.getByRole('textbox', {
    name: 'Comment',
    exact: true,
  });
  await webHeader.click();
  await comment.fill('Keep the web feedback open.');
  await serverHeader.click();
  await comment.fill('Send the server feedback.');
  await app.page.getByRole('button', { name: 'Comment', exact: true }).click();
  await held.requested;
  await webHeader.click();
  await expect.element(comment).toHaveValue('Keep the web feedback open.');
  held.release();
  await expect
    .poll(() => server.reviewComments(published.reviewId ?? ''))
    .toMatchObject([{ messages: [{ body: 'Send the server feedback.' }] }]);
  await expect.element(comment).toBeEnabled();
  await expect.element(comment).toHaveValue('Keep the web feedback open.');
});

test('published revisions keep separate drafts and returning posts on the original revision', async ({
  repo,
  render,
  server,
}) => {
  const first = await repo.review('Discuss the saved revision');
  const route = (revision: number) =>
    `/reviews/${first.reviewId}/${revision}/decisions/${first.layerId}`;
  const app = await render.route(route(first.revision));
  const header = app.page.getByRole('button', {
    name: /^Comment on review-page\.ts \(/,
  });
  const comment = app.page.getByRole('textbox', {
    name: 'Comment',
    exact: true,
  });
  await header.click();
  await comment.fill('Keep this draft on revision one.');
  const second = await repo.review('Discuss the saved revision');
  await app.navigate(route(second.revision));
  await header.click();
  await expect.element(comment).toHaveValue('');
  await comment.fill('A separate draft for revision two.');
  await app.navigate(route(first.revision));
  await header.click();
  await expect.element(comment).toHaveValue('Keep this draft on revision one.');
  await userEvent.keyboard('{Control>}{Enter}{/Control}');
  await expect
    .poll(() => server.reviewComments(first.reviewId))
    .toMatchObject([
      {
        review: { reviewId: first.reviewId, revision: first.revision },
        anchor: { revision: first.headOid },
        messages: [{ body: 'Keep this draft on revision one.' }],
      },
    ]);
});

test('file drafts keep their own text across decisions and cancel clears only the selected draft', async ({
  agent,
  render,
  server,
}) => {
  await agent.publishArchitecture();
  const published = (await server.publishedReview()).review;
  const decision = published?.layers.find(
    (layer) => layer.title === 'Schedule reminders durably',
  );
  if (!published?.reviewId || !decision)
    throw new Error('The fixture needs its reminder decision.');
  const app = await render.route(
    `/reviews/${published.reviewId}?decision=${decision.id}`,
  );
  const serverHeader = app.page.getByRole('button', {
    name: 'Comment on apps/server/src/schedule-reminder.ts (modified)',
    exact: true,
  });
  const webHeader = app.page.getByRole('button', {
    name: 'Comment on apps/web/src/schedule-reminder.ts (modified)',
    exact: true,
  });
  const comment = app.page.getByRole('textbox', {
    name: 'Comment',
    exact: true,
  });
  await serverHeader.click();
  await comment.fill('Keep the server draft while reading another decision.');
  await app.page
    .getByRole('button', { name: 'Next stop', exact: true })
    .click();
  await app.page
    .getByRole('button', { name: 'Previous stop', exact: true })
    .click();
  await serverHeader.click();
  await expect
    .element(comment)
    .toHaveValue('Keep the server draft while reading another decision.');
  await webHeader.click();
  await comment.fill('Keep a separate draft on the web entry.');
  await serverHeader.click();
  await expect
    .element(comment)
    .toHaveValue('Keep the server draft while reading another decision.');
  await userEvent.keyboard('{Escape}');
  await serverHeader.click();
  await expect.element(comment).toHaveValue('');
  await webHeader.click();
  await expect
    .element(comment)
    .toHaveValue('Keep a separate draft on the web entry.');
});

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

test('Ask the agent retains its draft across completion navigation and posts on the whole change', async ({
  agent,
  render,
  server,
}) => {
  await agent.publishArchitecture();
  const published = (await server.publishedReview()).review;
  if (!published?.reviewId) throw new Error('The fixture needs a review.');
  const app = await render.route(`/reviews/${published.reviewId}`);
  await app.page
    .getByRole('button', { name: 'Not explained', exact: true })
    .click();
  const completion = app.page.getByRole('region', {
    name: 'Review completion',
    exact: true,
  });
  const ask = completion.getByRole('button', {
    name: 'Ask the agent',
    exact: true,
  });
  const comment = completion.getByRole('textbox', {
    name: 'Comment',
    exact: true,
  });
  const body = 'Explain the remaining changes before I finish this review.';
  await ask.click();
  await comment.fill(body);
  await app.page
    .getByRole('button', { name: 'Previous stop', exact: true })
    .click();
  await app.page
    .getByRole('button', { name: 'Next stop', exact: true })
    .click();
  await ask.click();
  await expect.element(comment).toHaveValue(body);
  await userEvent.keyboard('{Control>}{Enter}{/Control}');
  await expect
    .poll(() => server.reviewComments(published.reviewId ?? ''))
    .toMatchObject([
      {
        review: { reviewId: published.reviewId, revision: published.revision },
        anchor: { kind: 'change', revision: published.headOid },
        messages: [{ body }],
      },
    ]);
  await expect.element(comment).not.toBeInTheDocument();
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
