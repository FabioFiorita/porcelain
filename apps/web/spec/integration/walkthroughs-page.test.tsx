import { page as browserPage, userEvent } from 'vite-plus/test/browser';
import { expect, test, type Repo } from './fixtures.tsx';

const SCENARIO = '.git/porcelain-fake-walkthrough';

async function branchWithTwoFiles(repo: Repo) {
  await repo.branch('feature');
  await repo.switch('feature');
  await repo.write('notes.md', 'first line\nsecond line\n');
  await repo.write('glossary.md', 'A term\n');
  await repo.commit('Add notes and a glossary');
}

test('a developer writes a walkthrough, watches it run and reads each step with its code', async ({
  repo,
  codingTool,
  render,
  server,
}) => {
  await browserPage.viewport(1280, 896);
  await branchWithTwoFiles(repo);
  await codingTool.install();
  await repo.write(SCENARIO, 'hold');
  const app = await render.route('/');
  const page = app.page;

  await expect
    .element(page.getByRole('tab', { name: 'Review', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(page.getByRole('tab', { name: 'Walkthrough', exact: true }))
    .not.toBeInTheDocument();
  await expect.poll(() => app.title()).toMatch(/^Review — /);
  await expect
    .element(
      page.getByRole('heading', { name: 'No walkthrough yet.', exact: true }),
    )
    .toBeVisible();
  const everyFile = page.getByRole('group', {
    name: 'Code: Every changed file',
    exact: true,
  });
  await expect
    .element(
      everyFile
        .getByRole('region', {
          name: 'Every changed file: branch',
          exact: true,
        })
        .getByText('first line', { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      everyFile
        .getByRole('region', {
          name: 'Every changed file: branch',
          exact: true,
        })
        .getByText('A change to review.', { exact: true }),
    )
    .toBeVisible();
  await page
    .getByRole('button', { name: 'Write walkthrough', exact: true })
    .click();
  await expect
    .element(page.getByText('Writing the walkthrough', { exact: true }))
    .toBeVisible();
  await expect
    .element(everyFile.getByText('first line', { exact: true }))
    .toBeVisible();

  await repo.remove(SCENARIO);
  await expect
    .element(
      page.getByRole('heading', {
        name: /^Teach the sample to explain itself$/,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      page.getByRole('heading', { name: 'How the system grew', exact: true }),
    )
    .toBeVisible();
  await expect
    .element(page.getByText('Kept by hand for now.', { exact: true }))
    .not.toBeInTheDocument();
  await page.getByRole('button', { name: '1 more', exact: true }).click();
  await expect
    .element(page.getByText('Kept by hand for now.', { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText('Not verified', { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText('Whether the notes should move.', { exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByText('notes', { exact: true }).first())
    .toBeVisible();
  await expect.poll(() => app.title()).toMatch(/^Teach the sample/);
  const notesStep = page
    .getByRole('listitem')
    .filter({ hasText: 'Step about notes.md' });
  await notesStep
    .getByRole('button', { name: /^Full diff of this step/ })
    .click();
  await expect
    .element(
      notesStep
        .getByRole('region', { name: /^Step \d: branch$/ })
        .getByText('first line', { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(notesStep.getByText('A term', { exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(
      notesStep.getByRole('textbox', {
        name: 'Comment on this step, or ask the agent',
        exact: true,
      }),
    )
    .toBeVisible();
  const readmeStep = page
    .getByRole('listitem')
    .filter({ hasText: 'Step about README.md' });
  await readmeStep
    .getByRole('button', { name: /^Full diff of this step/ })
    .click();
  await expect
    .element(
      readmeStep
        .getByRole('region', { name: /^Step \d: branch$/ })
        .getByText('A change to review.', { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      page.getByRole('heading', {
        name: 'Not covered by the steps',
        exact: true,
      }),
    )
    .not.toBeInTheDocument();

  const sidebar = page.getByRole('complementary', {
    name: 'Review sidebar',
    exact: true,
  });
  await expect
    .element(sidebar.getByRole('tab', { name: 'Branch', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(sidebar.getByText('By step', { exact: true }))
    .toBeVisible();
  await expect
    .element(sidebar.getByRole('img', { name: 'Your call', exact: true }))
    .toBeVisible();

  const firstStep = sidebar.getByRole('group', { name: 'Step 1', exact: true });
  await expect
    .element(
      firstStep.getByRole('button', {
        name: 'README.md · modified',
        exact: true,
      }),
    )
    .toBeVisible();
  const tick = firstStep.getByRole('checkbox', {
    name: 'README.md reviewed',
    exact: true,
  });
  await expect.element(tick).not.toBeChecked();
  await tick.click();
  await expect.element(tick).toBeChecked();
  await expect
    .element(sidebar.getByText(/^1 of \d+ files? reviewed$/))
    .toBeVisible();

  await sidebar.getByRole('button', { name: 'Step 1', exact: true }).click();
  await expect
    .element(page.getByRole('region', { name: 'Right pane', exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole('tab', { name: 'Step 1', exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole('heading', { name: /^Step 1 of 3: / }))
    .toBeVisible();
  await expect
    .element(
      sidebar.getByRole('button', {
        name: 'README.md · modified',
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      page
        .getByRole('tabpanel', { name: 'Step 1', exact: true })
        .getByText('first line', { exact: true }),
    )
    .not.toBeInTheDocument();
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect
    .element(page.getByRole('heading', { name: /^Step 2 of 3: / }))
    .toBeVisible();
  await page.getByRole('tab', { name: 'Review', exact: true }).click();
  await expect
    .element(page.getByRole('heading', { name: /^Teach the sample/ }))
    .toBeVisible();

  await expect
    .poll(async () => (await server.walkthrough()).walkthrough?.state.status)
    .toBe('ready');
});

test('local edits group by step, and files the walkthrough never read stand apart', async ({
  repo,
  codingTool,
  render,
}) => {
  await browserPage.viewport(1280, 896);
  await branchWithTwoFiles(repo);
  await codingTool.install();
  const app = await render.route('/');
  const page = app.page;
  await page.getByRole('tab', { name: 'Review', exact: true }).click();
  await page
    .getByRole('button', { name: 'Write walkthrough', exact: true })
    .click();
  await expect
    .element(
      page.getByRole('heading', {
        name: /^Teach the sample to explain itself$/,
      }),
    )
    .toBeVisible();

  await repo.write('notes.md', 'first line\nsecond line\nthird line\n');
  await repo.write('local-note.txt', 'not read yet\n');
  const sidebar = page.getByRole('complementary', {
    name: 'Review sidebar',
    exact: true,
  });
  await sidebar.getByRole('tab', { name: 'Uncommitted', exact: true }).click();
  await expect
    .element(sidebar.getByText('Not in the walkthrough yet', { exact: true }))
    .toBeVisible();
  await expect
    .element(sidebar.getByRole('button', { name: 'All changes', exact: true }))
    .toBeVisible();
  await expect
    .element(sidebar.getByRole('button', { name: 'Step 3', exact: true }))
    .toBeVisible();
  await expect
    .element(sidebar.getByRole('button', { name: 'Step 2', exact: true }))
    .not.toBeInTheDocument();
});

test('with Spec files on, specs outside the walkthrough get their own list', async ({
  repo,
  codingTool,
  render,
}) => {
  await browserPage.viewport(1280, 896);
  await branchWithTwoFiles(repo);
  await codingTool.install();
  const app = await render.route('/');
  const page = app.page;
  await page.getByRole('tab', { name: 'Review', exact: true }).click();
  await page
    .getByRole('button', { name: 'Write walkthrough', exact: true })
    .click();
  await expect
    .element(
      page.getByRole('heading', {
        name: /^Teach the sample to explain itself$/,
      }),
    )
    .toBeVisible();
  await repo.write('local-note.txt', 'not read yet\n');
  await repo.write('local-note.spec.ts', 'not read yet either\n');
  const review = app.location();
  await app.navigate('/settings/git');
  await page
    .getByRole('button', {
      name: 'Use these settings for this computer',
      exact: true,
    })
    .click();
  const setting = page.getByRole('switch', { name: 'Spec files', exact: true });
  await setting.click();
  await expect.element(setting).toBeChecked();
  await app.navigate(review);
  const sidebar = page.getByRole('complementary', {
    name: 'Review sidebar',
    exact: true,
  });
  await sidebar.getByRole('tab', { name: 'Uncommitted', exact: true }).click();
  const outside = sidebar.getByRole('group', {
    name: 'Not in the walkthrough yet',
    exact: true,
  });
  const specs = sidebar.getByRole('group', { name: 'Specs', exact: true });
  await expect
    .element(specs.getByText(/local-note\.spec\.ts/).first())
    .toBeVisible();
  await expect
    .element(outside.getByText(/local-note\.txt/).first())
    .toBeVisible();
  await expect
    .element(outside.getByText(/local-note\.spec\.ts/))
    .not.toBeInTheDocument();
});

test('a later commit lists its file outside the steps, and a refused Update says why', async ({
  repo,
  codingTool,
  render,
}) => {
  await browserPage.viewport(1280, 896);
  await branchWithTwoFiles(repo);
  await codingTool.install();
  const app = await render.route('/');
  const page = app.page;
  await page.getByRole('tab', { name: 'Review', exact: true }).click();
  await page
    .getByRole('button', { name: 'Write walkthrough', exact: true })
    .click();
  await expect
    .element(
      page.getByRole('heading', {
        name: /^Teach the sample to explain itself$/,
      }),
    )
    .toBeVisible();
  await expect
    .poll(() => app.title())
    .toMatch(/^Teach the sample to explain itself — /);

  await repo.write('later.md', 'later\n');
  await repo.commit('Add a later file');
  const sidebar = page.getByRole('complementary', {
    name: 'Review sidebar',
    exact: true,
  });
  await expect
    .element(sidebar.getByText('Not in the walkthrough yet', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      sidebar.getByRole('button', { name: 'later.md · added', exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      page.getByRole('heading', {
        name: 'Not covered by the steps',
        exact: true,
      }),
    )
    .toBeVisible();
  await page
    .getByRole('group', { name: 'Code: Not covered by the steps', exact: true })
    .getByText('later.md', { exact: true })
    .click();
  await expect
    .element(
      page
        .getByRole('region', {
          name: 'Not covered by the steps: branch',
          exact: true,
        })
        .getByText('later', { exact: true }),
    )
    .toBeVisible();

  await app.navigate(
    `${app.location().split('?')[0]}?base=refs%2Fheads%2Fmissing`,
  );
  await page
    .getByRole('button', { name: 'Update walkthrough', exact: true })
    .click();
  await expect
    .element(
      page.getByRole('alert').filter({
        hasText: /^The walkthrough didn't finish\. Choose a base branch/,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      page.getByRole('heading', {
        name: /^Teach the sample to explain itself$/,
      }),
    )
    .toBeVisible();
});

test('a commit marks the walkthrough out of date and Update writes it again', async ({
  repo,
  codingTool,
  render,
  server,
}) => {
  await branchWithTwoFiles(repo);
  await codingTool.install();
  const app = await render.route('/');
  const page = app.page;
  await page.getByRole('tab', { name: 'Review', exact: true }).click();
  await page
    .getByRole('button', { name: 'Write walkthrough', exact: true })
    .click();
  await expect
    .element(
      page.getByRole('heading', {
        name: /^Teach the sample to explain itself$/,
      }),
    )
    .toBeVisible();
  const firstId = (await server.walkthrough()).walkthrough?.id;

  await repo.write('notes.md', 'changed again\n');
  await repo.commit('Change the notes again');
  const updatedHead = (await server.gitStatus()).headOid;
  await expect
    .element(
      page.getByRole('button', { name: 'Update walkthrough', exact: true }),
    )
    .toBeVisible();
  await repo.write(SCENARIO, 'hold');
  await page
    .getByRole('button', { name: 'Update walkthrough', exact: true })
    .click();
  await expect
    .element(page.getByText('Writing the walkthrough', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      page.getByRole('heading', {
        name: /^Teach the sample to explain itself$/,
      }),
    )
    .toBeVisible();
  await expect
    .element(page.getByText('By step', { exact: true }))
    .toBeVisible();
  await page
    .getByRole('complementary', { name: 'Review sidebar', exact: true })
    .getByRole('button', { name: 'Step 1', exact: true })
    .click();
  await expect
    .element(page.getByRole('tab', { name: 'Step 1', exact: true }))
    .toBeVisible();
  await page.getByRole('tab', { name: 'Review', exact: true }).click();
  await repo.write(SCENARIO, 'signed-out');
  await expect
    .element(page.getByRole('button', { name: 'Try again', exact: true }))
    .toBeVisible();
  await expect
    .element(
      page.getByRole('heading', {
        name: /^Teach the sample to explain itself$/,
      }),
    )
    .toBeVisible();
  await repo.remove(SCENARIO);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect
    .element(
      page.getByText(new RegExp(`written for ${updatedHead?.slice(0, 7)}`)),
    )
    .toBeVisible();
  await expect(server.walkthrough()).resolves.not.toMatchObject({
    walkthrough: { id: firstId },
  });
  await expect
    .element(
      page.getByRole('heading', {
        name: /^Teach the sample to explain itself$/,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      page.getByRole('button', { name: 'Update walkthrough', exact: true }),
    )
    .toBeVisible();
});

test('a signed-out writer names the sign-in command and Try again runs it again', async ({
  repo,
  codingTool,
  render,
}) => {
  await branchWithTwoFiles(repo);
  await codingTool.install();
  await repo.write(SCENARIO, 'signed-out');
  const app = await render.route('/');
  const page = app.page;
  await page.getByRole('tab', { name: 'Review', exact: true }).click();
  await page
    .getByRole('button', { name: 'Write walkthrough', exact: true })
    .click();
  await expect
    .element(
      page.getByRole('heading', {
        name: 'Sign in to Claude again with claude auth login, then try again.',
        exact: true,
      }),
    )
    .toBeVisible();

  await repo.remove(SCENARIO);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect
    .element(
      page.getByRole('heading', {
        name: /^Teach the sample to explain itself$/,
      }),
    )
    .toBeVisible();
});

test('a walkthrough with nothing to say shows the short page above every changed file', async ({
  repo,
  codingTool,
  render,
}) => {
  await branchWithTwoFiles(repo);
  await codingTool.install();
  await repo.write(SCENARIO, 'nothing');
  const app = await render.route('/');
  const page = app.page;
  await page.getByRole('tab', { name: 'Review', exact: true }).click();
  await page
    .getByRole('button', { name: 'Write walkthrough', exact: true })
    .click();
  await expect
    .element(
      page.getByRole('heading', {
        name: /^A small routine change$/,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      page
        .getByRole('group', { name: 'Code: Every changed file', exact: true })
        .getByText('first line', { exact: true }),
    )
    .toBeVisible();
});

test('uncommitted-only work opens the review with its diffs and stays fresh when its explained content is committed', async ({
  repo,
  codingTool,
  render,
  server,
}) => {
  await browserPage.viewport(1280, 896);
  await repo.branch('working-base');
  await repo.branch('working-feature');
  await repo.switch('working-feature');
  await repo.write('notes.md', 'first line\nsecond line\n');
  await codingTool.install();
  const app = await render.route('/?base=refs%2Fheads%2Fworking-base');
  const page = app.page;
  await expect
    .element(page.getByRole('tab', { name: 'Review', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(
      page
        .getByRole('region', {
          name: 'Every changed file: uncommitted',
          exact: true,
        })
        .getByText('first line', { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      page.getByRole('heading', { name: 'No walkthrough yet.', exact: true }),
    )
    .toBeVisible();
  await page
    .getByRole('button', { name: 'Write walkthrough', exact: true })
    .click();
  await expect
    .element(
      page.getByRole('heading', {
        name: /^Teach the sample to explain itself$/,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      page.getByText(
        /\d+ files?, \d+ uncommitted · written for .* and uncommitted work/,
      ),
    )
    .toBeVisible();
  const sidebar = page.getByRole('complementary', {
    name: 'Review sidebar',
    exact: true,
  });
  await expect
    .element(sidebar.getByRole('tab', { name: 'Uncommitted', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(sidebar.getByText('By step', { exact: true }))
    .toBeVisible();
  await sidebar.getByRole('tab', { name: 'Branch', exact: true }).click();
  await expect
    .element(sidebar.getByText('No changes since main', { exact: true }))
    .toBeVisible();
  await expect
    .element(sidebar.getByText('By step', { exact: true }))
    .not.toBeInTheDocument();
  await expect
    .poll(() =>
      new URL(app.location(), 'http://test').searchParams.get('scope'),
    )
    .toBe('branch');
  await expect
    .element(sidebar.getByRole('tab', { name: 'Branch', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await sidebar.getByRole('tab', { name: 'Uncommitted', exact: true }).click();
  const before = (await server.walkthrough()).walkthrough;
  await repo.commit('Commit the explained content');
  const committedHead = (await server.gitStatus()).headOid;
  await expect(server.walkthrough()).resolves.toMatchObject({
    freshness: 'current',
  });
  await expect
    .element(
      page.getByRole('button', { name: 'Update walkthrough', exact: true }),
    )
    .toBeVisible();
  const status = page.getByRole('region', {
    name: 'Walkthrough status',
    exact: true,
  });
  await expect.element(status.getByText(/^Saved /)).toBeVisible();
  await expect
    .element(
      page.getByRole('progressbar', {
        name: 'Walkthrough stages',
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
  await expect
    .element(page.getByText('Update log', { exact: true }))
    .not.toBeInTheDocument();
  await page
    .getByRole('button', { name: 'Update walkthrough', exact: true })
    .click();
  await expect
    .element(
      status.getByText(
        'Already up to date: the saved walkthrough was reused.',
        { exact: true },
      ),
    )
    .toBeVisible();
  await repo.write('notes.md', 'first line\nsecond line\nnew edit\n');
  await expect
    .element(
      page
        .getByRole('region', { name: 'Walkthrough status', exact: true })
        .getByText(/· Behind the current work$/),
    )
    .toBeVisible();
  await expect(server.walkthrough()).resolves.toMatchObject({
    walkthrough: { id: before?.id },
  });
  await page
    .getByRole('button', { name: 'Update walkthrough', exact: true })
    .click();
  await expect
    .element(
      page.getByText(new RegExp(`written for ${committedHead?.slice(0, 7)}`)),
    )
    .toBeVisible();
  await expect(server.walkthrough()).resolves.not.toMatchObject({
    walkthrough: { id: before?.id },
  });
  await expect
    .element(
      page.getByRole('heading', {
        name: /^Teach the sample to explain itself$/,
      }),
    )
    .toBeVisible();
});

for (const state of ['uncommitted', 'mixed', 'committed'] as const) {
  test(`a ${state} walkthrough shows the step's code in every scope it owns`, async ({
    repo,
    codingTool,
    render,
  }) => {
    await browserPage.viewport(1280, 896);
    await repo.branch('code-base');
    await repo.branch('code-feature');
    await repo.switch('code-feature');
    if (state !== 'uncommitted') await repo.commit('Commit the README change');
    if (state === 'mixed')
      await repo.write(
        'README.md',
        '# Sample repository\n\nA change to review.\nWorking line in the same step.\n',
      );
    await codingTool.install();
    const app = await render.route('/?base=refs%2Fheads%2Fcode-base');
    const page = app.page;
    await page.getByRole('tab', { name: 'Review', exact: true }).click();
    await page
      .getByRole('button', { name: 'Write walkthrough', exact: true })
      .click();
    await expect
      .element(
        page.getByRole('heading', {
          name: /^Teach the sample to explain itself$/,
        }),
      )
      .toBeVisible();
    await page
      .getByRole('article', { name: /^Step 1.*README\.md/ })
      .getByRole('button', { name: /^Full diff of this step/ })
      .click();
    const branch = page.getByRole('region', {
      name: 'Step 1: branch',
      exact: true,
    });
    const working = page.getByRole('region', {
      name: 'Step 1: uncommitted',
      exact: true,
    });
    if (state !== 'uncommitted')
      await expect
        .element(branch.getByText('A change to review.', { exact: true }))
        .toBeVisible();
    else await expect.element(branch).not.toBeInTheDocument();
    if (state !== 'committed')
      await expect
        .element(
          working.getByText(
            state === 'mixed'
              ? 'Working line in the same step.'
              : 'A change to review.',
            { exact: true },
          ),
        )
        .toBeVisible();
    else await expect.element(working).not.toBeInTheDocument();
    await expect
      .element(
        page.getByRole('heading', {
          name: 'Not covered by the steps',
          exact: true,
        }),
      )
      .not.toBeInTheDocument();
  });
}

for (const state of ['uncommitted', 'mixed', 'committed'] as const) {
  test(`the ${state} step review toggles its files together and leaves other steps alone`, async ({
    repo,
    codingTool,
    render,
    server,
  }) => {
    await browserPage.viewport(1280, 896);
    await repo.branch('review-base');
    await repo.branch('review-feature');
    await repo.switch('review-feature');
    await repo.write('alpha.md', 'Alpha change\n');
    await repo.write('zebra.md', 'Other step\n');
    if (state !== 'uncommitted') await repo.commit('Commit step changes');
    if (state === 'mixed') {
      await repo.write('README.md', '# Sample repository\n\nLater edit\n');
      await repo.write('alpha.md', 'Later alpha edit\n');
      await repo.write('zebra.md', 'Later change in another step\n');
    }
    await codingTool.install();
    await repo.write(SCENARIO, 'grouped');
    const app = await render.route('/?base=refs%2Fheads%2Freview-base');
    const page = app.page;
    await page.getByRole('tab', { name: 'Review', exact: true }).click();
    await page
      .getByRole('button', { name: 'Write walkthrough', exact: true })
      .click();
    await page
      .getByRole('complementary', { name: 'Review sidebar', exact: true })
      .getByRole('button', { name: 'Step 1', exact: true })
      .click();
    const reviewed = page
      .getByRole('toolbar', { name: 'Document controls', exact: true })
      .getByRole('button', { name: 'Reviewed', exact: true });
    const marks = async (branch?: string) =>
      (await server.reviewedFiles(branch)).marks
        .map((mark) => mark.path)
        .toSorted();
    for (const entry of [
      ...(state !== 'uncommitted' ? ['branch:zebra.md'] : []),
      ...(state !== 'committed' ? ['change:zebra.md'] : []),
    ]) {
      await app.navigate(
        `${app.location().split('?')[0]}?base=refs%2Fheads%2Freview-base&entry=${entry}`,
      );
      await expect.element(reviewed).toHaveAttribute('aria-pressed', 'false');
      await reviewed.click();
      await expect
        .poll(() =>
          marks(
            entry.startsWith('branch:')
              ? 'refs/heads/review-feature'
              : undefined,
          ),
        )
        .toEqual(['zebra.md']);
    }
    await page.getByRole('tab', { name: 'Step 1', exact: true }).click();
    await reviewed.click();
    if (state !== 'uncommitted')
      await expect
        .poll(() => marks('refs/heads/review-feature'))
        .toEqual(['README.md', 'alpha.md', 'zebra.md']);
    if (state !== 'committed')
      await expect
        .poll(() => marks())
        .toEqual(['README.md', 'alpha.md', 'zebra.md']);
    await expect.element(reviewed).toHaveAttribute('aria-pressed', 'true');
    await expect
      .element(page.getByText('Step marked reviewed', { exact: true }))
      .toBeVisible();
    await expect
      .element(
        page
          .getByRole('toolbar', { name: 'Document controls', exact: true })
          .getByText(/Marked \d+ files?\./),
      )
      .not.toBeInTheDocument();
    await userEvent.keyboard('r');
    await expect
      .poll(() => marks('refs/heads/review-feature'))
      .toEqual(state === 'uncommitted' ? [] : ['zebra.md']);
    await expect
      .poll(() => marks())
      .toEqual(state === 'committed' ? [] : ['zebra.md']);
    await expect.element(reviewed).toHaveAttribute('aria-pressed', 'false');
    const path = state === 'committed' ? 'branch:alpha.md' : 'change:alpha.md';
    await app.navigate(
      `${app.location().split('?')[0]}?base=refs%2Fheads%2Freview-base&entry=${path}`,
    );
    await reviewed.click();
    await expect
      .poll(() =>
        marks(state === 'committed' ? 'refs/heads/review-feature' : undefined),
      )
      .toEqual(['alpha.md', 'zebra.md']);
    await page.getByRole('tab', { name: 'Step 1', exact: true }).click();
    await expect.element(reviewed).toHaveAttribute('aria-pressed', 'false');
    await userEvent.keyboard('r');
    if (state !== 'uncommitted')
      await expect
        .poll(() => marks('refs/heads/review-feature'))
        .toEqual(['README.md', 'alpha.md', 'zebra.md']);
    if (state !== 'committed')
      await expect
        .poll(() => marks())
        .toEqual(['README.md', 'alpha.md', 'zebra.md']);
    await expect.element(reviewed).toHaveAttribute('aria-pressed', 'true');
    await reviewed.click();
    await expect
      .poll(() => marks('refs/heads/review-feature'))
      .toEqual(state === 'uncommitted' ? [] : ['zebra.md']);
    await expect
      .poll(() => marks())
      .toEqual(state === 'committed' ? [] : ['zebra.md']);
  });
}

test('a walkthrough that cannot be read still shows every changed file', async ({
  fetchGate,
  render,
}) => {
  fetchGate.failWalkthroughReads();
  const workspace = await render.workspace();
  await expect
    .element(
      workspace.getByText('The walkthrough could not be read.', {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      workspace
        .getByRole('region', {
          name: 'Every changed file: uncommitted',
          exact: true,
        })
        .getByText('A change to review.', { exact: true }),
    )
    .toBeVisible();
});

test('a step citing a staged rename shows the committed file and its local edit together', async ({
  repo,
  codingTool,
  render,
}) => {
  await browserPage.viewport(1280, 896);
  await repo.branch('rename-base');
  await repo.branch('rename-feature');
  await repo.switch('rename-feature');
  await repo.write('old-name.md', 'Committed line\n');
  await repo.commit('Add the old name');
  await repo.rename('old-name.md', 'new-name.md');
  await repo.write('new-name.md', 'Committed line\nLocal line\n');
  await codingTool.install();
  const app = await render.route('/?base=refs%2Fheads%2Frename-base');
  const page = app.page;
  await page
    .getByRole('button', { name: 'Write walkthrough', exact: true })
    .click();
  const step = page
    .getByRole('listitem')
    .filter({ hasText: 'Step about new-name.md' });
  await step.getByRole('button', { name: /^Full diff of this step/ }).click();
  await expect
    .element(
      step
        .getByRole('region', { name: /^Step \d: branch$/ })
        .getByText('Committed line', { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      step
        .getByRole('region', { name: /^Step \d: uncommitted$/ })
        .getByText('Local line', { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      page.getByRole('region', {
        name: 'Not covered by the steps: branch',
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
});

for (const side of ['old', 'new'] as const) {
  test(`the inline excerpt shows the ${side} side of a captured dirty rename and stays in its step`, async ({
    repo,
    codingTool,
    render,
    server,
  }) => {
    await browserPage.viewport(1280, 896);
    const lines = Array.from(
      { length: 15 },
      (_, index) => `Unchanged line ${index + 1}`,
    );
    const notes = () => `${lines.join('\n')}\n`;
    await repo.write('original notes.txt', notes());
    await repo.commit('Add the original notes');
    await repo.branch('excerpt-base');
    await repo.branch('excerpt-feature');
    await repo.switch('excerpt-feature');
    lines[1] = 'Rule committed on the branch';
    await repo.write('original notes.txt', notes());
    await repo.commit('Change the branch rule');
    await repo.rename('original notes.txt', 'renamed notes.txt');
    lines[9] = 'Rule from the captured local edit';
    const prefix = 'One\nTwo\nThree\nFour\nFive\nSix\n';
    await repo.write('renamed notes.txt', `${prefix}${notes()}`);
    await codingTool.install();
    await repo.write(SCENARIO, `line-excerpt-${side}`);
    const { page } = await render.route('/?base=refs%2Fheads%2Fexcerpt-base');
    await page
      .getByRole('button', { name: 'Write walkthrough', exact: true })
      .click();
    const step = page
      .getByRole('listitem')
      .filter({ hasText: 'Step about renamed notes.txt' });
    const location =
      side === 'old'
        ? 'original notes.txt · Old line 10'
        : 'renamed notes.txt · New line 16';
    const hide = step.getByRole('button', {
      name: `Hide the lines: ${location}`,
      exact: true,
    });
    const show = step.getByRole('button', {
      name: `Show the lines: ${location}`,
      exact: true,
    });
    const expectedLine =
      side === 'old'
        ? 'Unchanged line 10'
        : 'Rule from the captured local edit';
    const qualifiedLine = step.getByText(expectedLine, { exact: true });
    await expect.element(hide).toBeVisible();
    await expect.element(qualifiedLine).toBeVisible();
    await expect
      .element(step.getByText('Rule committed on the branch', { exact: true }))
      .not.toBeInTheDocument();
    await hide.click();
    await expect.element(show).toHaveFocus();
    await expect.element(qualifiedLine).not.toBeInTheDocument();
    if (side === 'old') return;
    const firstRunId = (await server.walkthrough()).walkthrough?.id;

    lines[9] = 'Rule in the current worktree';
    await repo.write(
      'renamed notes.txt',
      `A new line before the snapshot\n${prefix}${notes()}`,
    );
    const status = page
      .getByRole('region', { name: 'Walkthrough status', exact: true })
      .getByRole('status');
    const stale = status.filter({ hasText: 'Behind the current work' });
    await expect.element(stale).toBeVisible();
    await show.click();
    await expect.element(qualifiedLine).toBeVisible();
    await expect
      .element(step.getByText('Rule in the current worktree', { exact: true }))
      .not.toBeInTheDocument();
    await repo.write(SCENARIO, 'hold');
    await page
      .getByRole('button', { name: 'Update walkthrough', exact: true })
      .click();
    await expect
      .element(page.getByText('Writing the walkthrough', { exact: true }))
      .toBeVisible();
    const savedId = async () => (await server.walkthrough()).walkthrough?.id;
    await expect.poll(savedId).toBe(firstRunId);
    await repo.write(SCENARIO, 'line-excerpt-updated');
    await expect.element(status.filter({ hasText: /^Saved / })).toBeVisible();
    await expect.element(stale).not.toBeInTheDocument();
    await expect.poll(savedId).toBeTypeOf('string');
    await expect.poll(savedId).not.toBe(firstRunId);
    await expect
      .element(
        step.getByRole('button', {
          name: 'Hide the lines: renamed notes.txt · New line 17',
          exact: true,
        }),
      )
      .toBeVisible();
    await expect
      .element(step.getByText('Rule in the current worktree', { exact: true }))
      .toBeVisible();
  });
}

test('a long walkthrough loads code when a distant step diff is opened', async ({
  repo,
  codingTool,
  render,
}) => {
  await repo.branch('many-base');
  await repo.branch('many-feature');
  await repo.switch('many-feature');
  for (let file = 1; file <= 30; file += 1) {
    const name = String(file).padStart(2, '0');
    await repo.write(
      `step-${name}.md`,
      Array.from(
        { length: 60 },
        (_, line) => `Step ${name} line ${line + 1}`,
      ).join('\n'),
    );
  }
  await repo.commit('Add many step files');
  await codingTool.install();
  const app = await render.route('/?base=refs%2Fheads%2Fmany-base');
  const page = app.page;
  await page
    .getByRole('button', { name: 'Write walkthrough', exact: true })
    .click();
  await page
    .getByRole('article', { name: /step-01\.md/ })
    .getByRole('button', { name: /^Full diff of this step/ })
    .click();
  const distantStep = page.getByRole('article', { name: /step-30\.md/ });
  const distantDiff = distantStep.getByRole('button', {
    name: /^Full diff of this step/,
  });
  await expect.element(distantDiff).toHaveAttribute('aria-expanded', 'false');
  await expect
    .element(distantStep.getByText('Step 30 line 1', { exact: true }))
    .not.toBeInTheDocument();
  await distantDiff.click();
  await expect
    .element(distantStep.getByText('Step 30 line 1', { exact: true }))
    .toBeVisible();
});

test('a newly visible distant step keeps its diff collapsed until opened', async ({
  repo,
  codingTool,
  render,
}) => {
  await browserPage.viewport(1280, 896);
  try {
    await repo.branch('wide-base');
    await repo.branch('wide-feature');
    await repo.switch('wide-feature');
    for (let file = 1; file <= 26; file += 1) {
      const name = String(file).padStart(2, '0');
      await repo.write(`wide-${name}.md`, `Wide ${name} line\n`);
    }
    await repo.commit('Add many small step files');
    await codingTool.install();
    const app = await render.route('/?base=refs%2Fheads%2Fwide-base');
    const page = app.page;
    await page
      .getByRole('button', { name: 'Write walkthrough', exact: true })
      .click();
    const distantStep = page.getByRole('article', { name: /wide-26\.md/ });
    const distantDiff = distantStep.getByRole('button', {
      name: /^Full diff of this step/,
    });
    await expect.element(distantDiff).toHaveAttribute('aria-expanded', 'false');
    await browserPage.viewport(1280, 30000);
    await expect.element(distantDiff).toBeInViewport();
    await expect
      .element(distantStep.getByText('Wide 26 line', { exact: true }))
      .not.toBeInTheDocument();
    await distantDiff.click();
    await expect
      .element(distantStep.getByText('Wide 26 line', { exact: true }))
      .toBeVisible();
  } finally {
    await browserPage.viewport(414, 896);
  }
});
