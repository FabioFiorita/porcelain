import { page as browserPage, userEvent } from 'vitest/browser';
import { expect, test, conversationFixture } from './fixtures.tsx';

const reply =
  'Keep the retry beside its owner. The local boundary is deliberate.';

test('asks, preserves a draft through an answer, saves two, and posts them together once', async ({
  render,
}) => {
  await conversationFixture('pr');
  await browserPage.viewport(1280, 896);
  const { page } = await render.route('/');
  const composer = page.getByRole('textbox', {
    name: 'Decide, or ask about this',
    exact: true,
  });
  await composer.fill('  Keep this boundary.  ');
  await userEvent.keyboard('{Enter}');
  await composer.fill('An unfinished thought');
  await expect
    .element(page.getByText(reply, { exact: true }).first())
    .toBeVisible();
  await expect.element(composer).toHaveValue('An unfinished thought');
  await expect
    .element(
      page.getByRole('button', { name: 'Read all', exact: true }).first(),
    )
    .not.toBeInTheDocument();
  await page
    .getByRole('button', { name: 'Save for later', exact: true })
    .first()
    .click();
  await expect
    .element(page.getByText('1 comment saved', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      page.getByRole('button', { name: 'Ask about this', exact: true }).first(),
    )
    .not.toBeInTheDocument();
  const step = page
    .getByRole('textbox', { name: 'Ask about this step', exact: true })
    .last();
  await expect.element(step).toBeVisible();
  await step.fill('Handle failures here.');
  await userEvent.keyboard('{Enter}');
  await expect
    .element(page.getByText(reply, { exact: true }).last())
    .toBeVisible();
  await page
    .getByRole('button', { name: 'Save for later', exact: true })
    .last()
    .click();
  await expect
    .element(page.getByText('2 comments saved', { exact: true }))
    .toBeVisible();
  await page
    .getByRole('button', { name: 'Post together on #423', exact: true })
    .dblClick();
  await expect
    .element(
      page.getByRole('link', { name: 'Posted on #423', exact: true }).first(),
    )
    .toBeVisible();
  const posts = () => conversationFixture('posts');
  await expect
    .poll(async () => (await posts()).trim().split('\n'))
    .toHaveLength(1);
  await expect.poll(posts).toContain('Keep this boundary.');
  await expect.poll(posts).toContain('Handle failures here.');
  await expect.poll(posts).toContain('Keep the retry beside its owner.');
  await conversationFixture('moved');
  await composer.fill('Keep the boundary explicit.');
  await userEvent.keyboard('{Enter}');
  await page
    .getByRole('button', { name: 'Post on #423', exact: true })
    .first()
    .click();
  await expect
    .element(
      page
        .getByRole('status')
        .filter({ hasText: 'Nothing was posted. Copy the brief instead.' }),
    )
    .toBeVisible();
  await page.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect
    .element(page.getByText('Copied brief', { exact: true }))
    .toBeVisible();
  await expect
    .poll(async () => (await posts()).trim().split('\n'))
    .toHaveLength(1);
});

test('a failed answer can be retried and a walkthrough without a PR copies its brief', async ({
  render,
}) => {
  await conversationFixture('no-pr');
  await conversationFixture('fail');
  const { page } = await render.route('/');
  const composer = page.getByRole('textbox', {
    name: 'Decide, or ask about this',
    exact: true,
  });
  await composer.fill('Why here?');
  await userEvent.keyboard('{Enter}');
  await expect
    .element(
      page
        .getByText(
          'The selected agent CLI stopped before answering. Ask again.',
          { exact: true },
        )
        .first(),
    )
    .toBeVisible();
  await conversationFixture('recover');
  await page
    .getByRole('button', { name: 'Try again', exact: true })
    .first()
    .click();
  await expect
    .element(page.getByText(reply, { exact: true }).first())
    .toBeVisible();
  await page
    .getByRole('button', { name: 'Copy as prompt', exact: true })
    .first()
    .click();
  await expect
    .element(page.getByText('Copied brief', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      page
        .getByRole('region', { name: 'Notifications', exact: true })
        .filter({ hasText: 'Copied brief' }),
    )
    .toMatchTextContent(/^Copied brief$/);
  await expect.poll(() => conversationFixture('posts')).toBe('');
});

test('retained comments on a short PR page remain readable, undoable and postable', async ({
  render,
}) => {
  await conversationFixture('short-pr');
  const { page } = await render.route('/');
  await expect
    .element(
      page.getByRole('heading', { name: 'Earlier comments', exact: true }),
    )
    .toBeVisible();
  await expect
    .element(page.getByText('Keep the original boundary.', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      page
        .getByText('The original boundary still matters.', { exact: true })
        .first(),
    )
    .toBeVisible();
  await expect
    .element(page.getByText('1 comment saved', { exact: true }))
    .toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .element(page.getByText('1 comment saved', { exact: true }))
    .not.toBeInTheDocument();
  await page
    .getByRole('button', { name: 'Save for later', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Post together on #424', exact: true })
    .click();
  await expect
    .poll(() => conversationFixture('posts'))
    .toContain('Keep the original boundary.');
});

test('retained comments on a short page without a PR can be copied together', async ({
  render,
}) => {
  await conversationFixture('short-copy');
  const { page } = await render.route('/');
  await expect
    .element(
      page.getByRole('heading', { name: 'Earlier comments', exact: true }),
    )
    .toBeVisible();
  await expect
    .element(page.getByText('Keep the original boundary.', { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole('button', { name: 'Undo', exact: true }))
    .toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .element(page.getByRole('button', { name: 'Copy as prompt', exact: true }))
    .toBeVisible();
  await page
    .getByRole('button', { name: 'Save for later', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Copy together', exact: true })
    .click();
  await expect
    .element(page.getByText('Copied brief', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      page
        .getByRole('region', { name: 'Notifications', exact: true })
        .filter({ hasText: 'Copied brief' }),
    )
    .toMatchTextContent(/^Copied brief$/);
  await expect.poll(() => conversationFixture('posts')).toBe('');
});

test('a posted comment keeps its original pull request number when the latest walkthrough names another PR', async ({
  render,
}) => {
  await conversationFixture('changed-pr');
  const { page } = await render.route('/');
  await expect
    .element(
      page.getByRole('button', { name: 'Post together on #424', exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      page.getByRole('link', { name: 'Posted on #423', exact: true }).first(),
    )
    .toHaveAttribute(
      'href',
      'https://github.com/example/sample/pull/423#issuecomment-1',
    );
  await expect
    .element(page.getByRole('link', { name: 'Posted on #424', exact: true }))
    .not.toBeInTheDocument();
});

for (const { scenario, notice } of [
  { scenario: 'running-update', notice: 'Writing the walkthrough' },
  {
    scenario: 'failed-update',
    notice: 'Sign in to Codex again with codex login, then try again.',
  },
] as const) {
  test(`a ${scenario} keeps the ready page conversations, composer and saved bar`, async ({
    render,
    server,
  }) => {
    const runId = await conversationFixture(scenario);
    await browserPage.viewport(1280, 896);
    const { page } = await render.route('/');
    await expect.element(page.getByText(notice, { exact: true })).toBeVisible();
    const progress = page.getByRole('progressbar', {
      name: 'Walkthrough stages',
      exact: true,
    });
    await expect.element(progress).toHaveAttribute('aria-valuenow', '3');
    await expect.element(progress).toHaveAttribute('aria-valuemax', '5');
    await expect
      .element(progress)
      .toHaveAttribute(
        'aria-valuetext',
        scenario === 'running-update'
          ? 'Writing the walkthrough'
          : 'Update failed',
      );
    await expect
      .element(
        page.getByRole('button', { name: 'Update walkthrough', exact: true }),
      )
      .not.toBeInTheDocument();
    await page.getByText('Update log', { exact: true }).click();
    await expect
      .element(page.getByText(/Codex is writing the updated walkthrough\.$/))
      .toBeVisible();
    await expect
      .element(
        page.getByRole('heading', {
          name: /^Keep retries beside their owner\./,
        }),
      )
      .toBeVisible();
    await expect
      .element(
        page.getByText('Keep the original boundary.', { exact: true }).first(),
      )
      .toBeVisible();
    await expect
      .element(
        page
          .getByText('The original boundary still matters.', { exact: true })
          .first(),
      )
      .toBeVisible();
    await expect
      .element(page.getByText('1 comment saved', { exact: true }))
      .toBeVisible();
    await expect
      .element(
        page.getByRole('button', {
          name: 'Post together on #423',
          exact: true,
        }),
      )
      .toBeVisible();
    await expect
      .poll(
        async () =>
          (await server.inventory()).projects
            .flatMap((project) => project.worktrees)
            .find(
              (worktree) =>
                worktree.walkthroughTitle === 'Keep retries beside their owner',
            )?.walkthroughTitle,
      )
      .toBe('Keep retries beside their owner');
    const composer = page.getByRole('textbox', {
      name: 'Decide, or ask about this',
      exact: true,
    });
    await composer.fill('A comment on the retained page.');
    await userEvent.keyboard('{Enter}');
    await expect
      .element(
        page
          .getByText('A comment on the retained page.', { exact: true })
          .first(),
      )
      .toBeVisible();
    await expect
      .poll(async () => (await server.walkthrough()).walkthrough?.id)
      .toBe(runId);
    await expect
      .poll(async () => (await server.walkthrough()).attempt?.state.status)
      .toBe(scenario === 'running-update' ? 'running' : 'failed');
    await expect
      .element(
        page.getByRole('button', {
          name: 'Post together on #423',
          exact: true,
        }),
      )
      .toBeVisible();
  });
}

test('switching branches shows the displayed walkthrough conversations and never the previous branch comments', async ({
  render,
  repo,
}) => {
  await conversationFixture('two-branches');
  await browserPage.viewport(1280, 896);
  const { page } = await render.route('/');
  await expect
    .element(page.getByText('Only branch A', { exact: true }).first())
    .toBeVisible();
  await expect
    .element(page.getByText('Only branch B', { exact: true }))
    .not.toBeInTheDocument();
  await repo.switch('conversation-branch-b');
  await expect
    .element(page.getByRole('heading', { name: /^Decisions on branch B/ }))
    .toBeVisible();
  await expect
    .element(page.getByText('Only branch B', { exact: true }).first())
    .toBeVisible();
  await expect
    .element(page.getByText('Only branch A', { exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(
      page.getByRole('button', { name: 'Post together on #424', exact: true }),
    )
    .toBeVisible();
});

test('opening a saved review fetches each conversation and diff key once', async ({
  live,
  render,
  repo,
  fetchGate,
}) => {
  await repo.branch('conversation-review');
  await repo.switch('conversation-review');
  await conversationFixture('no-pr');
  await browserPage.viewport(1440, 900);
  live.drop();
  const reviewed = fetchGate.holdNextReviewedFiles();
  reviewed.arm();
  const requests = fetchGate.recordReviewReads();
  const { page } = await render.route('/');
  try {
    await reviewed.requested;
    await expect
      .element(
        page.getByRole('heading', { name: /Keep retries beside their owner/ }),
      )
      .toBeVisible();
  } finally {
    reviewed.release();
  }
  await expect
    .element(page.getByText('A conversation fixture.', { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText('A change to review.', { exact: true }))
    .toBeVisible();
  await expect
    .poll(() => requests.filter(({ path }) => path.endsWith('/conversations')))
    .toHaveLength(1);
  const patches = () => requests.filter(({ path }) => path.endsWith('/diffs'));
  await expect
    .poll(() =>
      patches().some(({ path }) => path.endsWith('/branch-changes/diffs')),
    )
    .toBe(true);
  await expect
    .poll(() => patches().some(({ path }) => path.endsWith('/changes/diffs')))
    .toBe(true);
  await expect
    .poll(() => {
      const keys = patches().map(({ path, body }) =>
        JSON.stringify([path, body]),
      );
      return keys.length - new Set(keys).size;
    })
    .toBe(0);
});

test('hidden review stops fetching images and conversations until shown again', async ({
  render,
  repo,
  server,
  fetchGate,
}) => {
  await conversationFixture('no-pr');
  await repo.writeBinary(
    'badge.png',
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPQmqkEAAHWAOYaE5nkAAAAAElFTkSuQmCC',
  );
  await repo.write(
    'logo.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
  );
  await repo.write('DRAFT', 'Extensionless source before the write');
  const project = await server.project();
  const worktree = project.worktrees[0]!;
  const route = `/${project.id}/${worktree.id}`;
  const requests = fetchGate.recordReviewReads();
  const text = fetchGate.recordTextReads();
  const app = await render.route(route);
  const { page } = app;
  const image = page.getByRole('img', { name: 'badge.png', exact: true });
  await expect.element(image).toBeVisible();
  await expect.poll(() => text).toContain('DRAFT');
  await expect.poll(() => text).toContain('logo.svg');
  await expect.poll(() => text).not.toContain('badge.png');
  await render.whenLiveConnected();
  await app.navigate(route + '?entry=file:DRAFT');
  const file = page.getByRole('tabpanel', { name: 'DRAFT', exact: true });
  await expect
    .element(
      file.getByText('Extensionless source before the write', { exact: true }),
    )
    .toBeVisible();
  requests.length = 0;
  await repo.write('DRAFT', 'Extensionless source after the write');
  await expect
    .element(
      file.getByText('Extensionless source after the write', { exact: true }),
    )
    .toBeVisible();
  await expect.poll(() => requests).toEqual([]);
  await page.getByRole('tab', { name: 'Review', exact: true }).click();
  await expect.element(image).toBeVisible();
  await expect
    .poll(() =>
      requests.some(({ path }) => path.endsWith('/asset?path=badge.png')),
    )
    .toBe(true);
  await expect
    .poll(() => requests.some(({ path }) => path.endsWith('/conversations')))
    .toBe(true);
});
