import { page as browserPage, userEvent } from 'vite-plus/test/browser';
import { expect, test, conversationFixture } from './fixtures.tsx';

const reply =
  'Keep the retry beside its owner. The local boundary is deliberate.';

test('asks, preserves a draft through an answer, and adds the answer to the review as a draft comment', async ({
  render,
}) => {
  await conversationFixture('pr');
  await browserPage.viewport(1280, 896);
  const { page } = await render.route('/');
  const composer = page
    .getByRole('textbox', {
      name: 'Comment on this step, or ask the agent',
      exact: true,
    })
    .first();
  await composer.fill('  Keep this boundary.  ');
  await userEvent.keyboard('{Enter}');
  await composer.fill('An unfinished thought');
  await expect
    .element(page.getByText(reply, { exact: true }).first())
    .toBeVisible();
  await expect.element(composer).toHaveValue('An unfinished thought');
  await expect
    .element(page.getByRole('button', { name: 'Save for later', exact: true }))
    .not.toBeInTheDocument();
  await page
    .getByRole('button', { name: 'Add to review', exact: true })
    .first()
    .click();
  await expect
    .element(page.getByText('Added to the review', { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText('1 comment not posted', { exact: true }))
    .toBeVisible();
  await expect.poll(() => conversationFixture('posts')).toBe('');
});

test('a failed answer can be retried', async ({ render }) => {
  await conversationFixture('no-pr');
  await conversationFixture('fail');
  const { page } = await render.route('/');
  const composer = page
    .getByRole('textbox', {
      name: 'Comment on this step, or ask the agent',
      exact: true,
    })
    .first();
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
});

for (const { scenario, notice } of [
  { scenario: 'running-update', notice: 'Writing the walkthrough' },
  {
    scenario: 'failed-update',
    notice: 'Sign in to Codex again with codex login, then try again.',
  },
] as const) {
  test(`a ${scenario} keeps the ready page conversations and composer`, async ({
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
          name: /^Keep retries beside their owner$/,
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
    const composer = page
      .getByRole('textbox', {
        name: 'Comment on this step, or ask the agent',
        exact: true,
      })
      .first();
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
  const composer = page
    .getByRole('textbox', {
      name: 'Comment on this step, or ask the agent',
      exact: true,
    })
    .first();
  await composer.fill(question);
  await repo.switch('conversation-branch-b');
  await expect
    .element(page.getByRole('heading', { name: /^Decisions on branch B/ }))
    .toBeVisible();
  await expect.element(composer).toHaveValue('');
  await expect
    .element(page.getByText('Only branch B', { exact: true }).first())
    .toBeVisible();
  await expect
    .element(page.getByText('Only branch A', { exact: true }))
    .not.toBeInTheDocument();
  await repo.switch('main');
  await expect
    .element(
      page.getByRole('heading', { name: /^Keep retries beside their owner/ }),
    )
    .toBeVisible();
  await expect.element(composer).toHaveValue(question);
});

const question = 'What happens with duplicate titles?';

test('keeps a question in its original step and worktree', async ({
  render,
  repo,
  server,
}) => {
  await conversationFixture('pr');
  await repo.worktree('other-draft-worktree');
  await expect
    .poll(async () =>
      (await server.project()).worktrees.some(
        (worktree) => worktree.branch === 'other-draft-worktree',
      ),
    )
    .toBe(true);
  await conversationFixture('other-worktree');
  await browserPage.viewport(1280, 896);
  const { page } = await render.route('/');
  const sidebar = page.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  const step = (title: string) =>
    page
      .getByRole('article', { name: new RegExp(`Step [0-9]+.*${title}$`) })
      .getByRole('textbox', {
        name: 'Comment on this step, or ask the agent',
        exact: true,
      });
  const originalStep = step('Failure handling');

  await sidebar.getByRole('button', { name: /Main worktree/ }).click();
  await expect
    .element(
      page.getByRole('heading', { name: /^Keep retries beside their owner/ }),
    )
    .toBeVisible();
  await originalStep.fill(question);
  await expect.element(originalStep).toHaveValue(question);
  await expect.element(step('Retry boundary')).toHaveValue('');
  await sidebar.getByRole('button', { name: /other-draft-worktree/ }).click();
  await expect
    .element(
      page.getByRole('heading', { name: /^Questions on the other worktree/ }),
    )
    .toBeVisible();
  await expect.element(originalStep).toHaveValue('');
  await sidebar.getByRole('button', { name: /Main worktree/ }).click();
  await expect.element(originalStep).toHaveValue(question);
});

test('keeps a step draft when a new walkthrough retains its title', async ({
  render,
  repo,
  server,
}) => {
  await conversationFixture('pr');
  const { page } = await render.route('/');
  const step = page
    .getByRole('textbox', {
      name: 'Comment on this step, or ask the agent',
      exact: true,
    })
    .last();
  const error = page.getByText('Finished walkthrough or step not found', {
    exact: true,
  });
  await step.fill(question);
  await conversationFixture('reject-send');
  await userEvent.keyboard('{Enter}');
  await expect.element(error).toBeVisible();
  await repo.write(
    'walkthrough-fixture.txt',
    'The revised conversation fixture.\n',
  );
  const revised = await conversationFixture('revision');
  await expect
    .poll(async () => (await server.walkthrough()).walkthrough?.id)
    .toBe(revised);
  await expect
    .element(page.getByRole('heading', { name: /^The revised retry guidance/ }))
    .toBeVisible();
  await expect.element(step).toHaveValue(question);
  await expect.element(error).not.toBeInTheDocument();
});

test('keeps a send error with its draft after switching worktrees', async ({
  render,
  repo,
}) => {
  await conversationFixture('pr');
  await repo.worktree('other-draft-worktree');
  await browserPage.viewport(1280, 896);
  const { page } = await render.route('/');
  const sidebar = page.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  const step = page
    .getByRole('textbox', {
      name: 'Comment on this step, or ask the agent',
      exact: true,
    })
    .last();
  const error = page.getByText('Finished walkthrough or step not found', {
    exact: true,
  });
  await sidebar.getByRole('button', { name: /Main worktree/ }).click();
  await step.fill(question);
  await conversationFixture('reject-send');
  await userEvent.keyboard('{Enter}');
  await expect.element(error).toBeVisible();
  await sidebar.getByRole('button', { name: /other-draft-worktree/ }).click();
  await expect.element(step).not.toBeInTheDocument();
  await sidebar.getByRole('button', { name: /Main worktree/ }).click();
  await expect.element(step).toHaveValue(question);
  await expect.element(error).toBeVisible();
  await step.fill('Can you explain the retry schedule?');
  await expect.element(error).not.toBeInTheDocument();
  await userEvent.keyboard('{Enter}');
  await expect.element(step).toHaveValue('');
  await expect.element(error).not.toBeInTheDocument();
});

test('an empty question keeps Ask reachable and says it is unavailable', async ({
  render,
}) => {
  await conversationFixture('pr');
  await browserPage.viewport(1280, 896);
  const { page } = await render.route('/');
  const composer = page
    .getByRole('textbox', {
      name: 'Comment on this step, or ask the agent',
      exact: true,
    })
    .first();
  const send = page.getByRole('button', { name: 'Ask', exact: true }).first();
  await expect.element(send).toHaveAttribute('aria-disabled', 'true');
  await composer.click();
  await userEvent.keyboard('{Tab}{Tab}');
  await expect.element(send).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  await expect.element(composer).toHaveValue('');
  await composer.fill('Is this boundary needed?');
  await expect.element(send).not.toHaveAttribute('aria-disabled', 'true');
});
