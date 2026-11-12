import { page as browserPage, userEvent } from 'vitest/browser';
import { expect, test, type Repo } from './fixtures.tsx';

const SCENARIO = '.git/porcelain-fake-walkthrough';

async function branchWithTwoFiles(repo: Repo) {
  await repo.branch('feature');
  await repo.switch('feature');
  await repo.write('notes.md', 'first line\nsecond line\n');
  await repo.write('glossary.md', 'A term\n');
  await repo.commit('Add notes and a glossary');
}

test('a developer writes a walkthrough, watches it run, reads the step and opens its code', async ({
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
    .element(page.getByRole('tab', { name: 'Walkthrough', exact: true }))
    .toBeVisible();
  await expect.poll(() => app.title()).toMatch(/^Changes — /);
  await expect
    .element(page.getByRole('tab', { name: 'Changes', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Walkthrough', exact: true }).click();
  await expect.poll(() => app.title()).toMatch(/^Walkthrough — /);
  await expect
    .element(
      page.getByRole('heading', { name: 'No walkthrough yet.', exact: true }),
    )
    .toBeVisible();
  await page
    .getByRole('button', { name: 'Write walkthrough', exact: true })
    .click();
  await expect
    .element(page.getByText('Writing the walkthrough', { exact: true }))
    .toBeVisible();

  await repo.remove(SCENARIO);
  await expect
    .element(
      page.getByRole('heading', {
        name: /^Teach the sample to explain itself\. One call is yours\.$/,
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
    .element(
      page.getByRole('heading', {
        name: "What the code doesn't say",
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(page.getByText('Whether the notes should move.', { exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByText('notes', { exact: true }).first())
    .toBeVisible();

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

  await page
    .getByRole('button', {
      name: 'Open code for step 2 in split view',
      exact: true,
    })
    .click();
  const left = page.getByRole('region', { name: 'Left pane', exact: true });
  const right = page.getByRole('region', { name: 'Right pane', exact: true });
  await expect
    .element(left.getByRole('heading', { name: /^Teach the sample/ }))
    .toBeVisible();
  await expect
    .element(right.getByRole('heading', { name: /^Step 2 of 3: / }))
    .toBeVisible();
  await right
    .getByRole('tab', { name: 'Step 2', exact: true })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Close pane', exact: true }).click();
  await expect.element(right).not.toBeInTheDocument();

  await page
    .getByRole('button', { name: 'See the code for step 1', exact: true })
    .click();
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
    .element(page.getByText('first line', { exact: true }))
    .not.toBeInTheDocument();
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect
    .element(page.getByRole('heading', { name: /^Step 2 of 3: / }))
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
  await page.getByRole('tab', { name: 'Walkthrough', exact: true }).click();
  await page
    .getByRole('button', { name: 'Write walkthrough', exact: true })
    .click();
  await expect
    .element(
      page.getByRole('heading', {
        name: /^Teach the sample to explain itself\. One call is yours\.$/,
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
  await page.getByRole('tab', { name: 'Walkthrough', exact: true }).click();
  await page
    .getByRole('button', { name: 'Write walkthrough', exact: true })
    .click();
  await expect
    .element(
      page.getByRole('heading', {
        name: /^Teach the sample to explain itself\. One call is yours\.$/,
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
        name: /^Teach the sample to explain itself\. One call is yours\.$/,
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
  await page.getByRole('tab', { name: 'Walkthrough', exact: true }).click();
  await page
    .getByRole('button', { name: 'Write walkthrough', exact: true })
    .click();
  await expect
    .element(
      page.getByRole('heading', {
        name: /^Teach the sample to explain itself\. One call is yours\.$/,
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
        name: /^Teach the sample to explain itself\. One call is yours\.$/,
      }),
    )
    .toBeVisible();
  await expect
    .element(page.getByText('By step', { exact: true }))
    .toBeVisible();
  await page
    .getByRole('button', { name: 'See the code for step 1', exact: true })
    .click();
  await expect
    .element(page.getByRole('tab', { name: 'Step 1', exact: true }))
    .toBeVisible();
  await page.getByRole('tab', { name: 'Walkthrough', exact: true }).click();
  await repo.write(SCENARIO, 'signed-out');
  await expect
    .element(page.getByRole('button', { name: 'Try again', exact: true }))
    .toBeVisible();
  await expect
    .element(
      page.getByRole('heading', {
        name: /^Teach the sample to explain itself\. One call is yours\.$/,
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
        name: /^Teach the sample to explain itself\. One call is yours\.$/,
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
  await page.getByRole('tab', { name: 'Walkthrough', exact: true }).click();
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
        name: /^Teach the sample to explain itself\. One call is yours\.$/,
      }),
    )
    .toBeVisible();
});

test('a walkthrough with nothing to say shows the short page and the way to the change', async ({
  repo,
  codingTool,
  render,
}) => {
  await branchWithTwoFiles(repo);
  await codingTool.install();
  await repo.write(SCENARIO, 'nothing');
  const app = await render.route('/');
  const page = app.page;
  await page.getByRole('tab', { name: 'Walkthrough', exact: true }).click();
  await page
    .getByRole('button', { name: 'Write walkthrough', exact: true })
    .click();
  await expect
    .element(
      page.getByRole('heading', {
        name: /^A small routine change\. Nothing needs you\.$/,
      }),
    )
    .toBeVisible();
  await page
    .getByRole('button', { name: 'See the change', exact: true })
    .click();
  await expect
    .element(page.getByRole('heading', { name: 'All changes', exact: true }))
    .toBeVisible();
});

test('uncommitted-only work opens Changes, offers a Walkthrough tab and stays fresh when its explained content is committed', async ({
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
    .element(page.getByRole('tab', { name: 'Changes', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(
      page.getByRole('heading', { name: '2 uncommitted changes', exact: true }),
    )
    .toBeVisible();
  await page.getByRole('tab', { name: 'Walkthrough', exact: true }).click();
  await expect
    .element(
      page.getByRole('heading', { name: 'No walkthrough yet.', exact: true }),
    )
    .toBeVisible();
  await page
    .getByRole('button', { name: 'Write walkthrough', exact: true })
    .click();
  await expect
    .element(page.getByRole('heading', { name: /One call is yours/ }))
    .toBeVisible();
  await expect
    .element(page.getByText(/written for .* and uncommitted work/))
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
  await repo.write('notes.md', 'first line\nsecond line\nnew edit\n');
  await expect
    .element(
      page.getByText(
        'The work changed after this walkthrough’s snapshot. Update to include the latest changes.',
        {
          exact: true,
        },
      ),
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
    .element(page.getByRole('heading', { name: /One call is yours/ }))
    .toBeVisible();
});

for (const state of ['uncommitted', 'mixed', 'committed'] as const) {
  test(`a ${state} walkthrough opens the code in every scope the step owns`, async ({
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
    await page.getByRole('tab', { name: 'Walkthrough', exact: true }).click();
    await page
      .getByRole('button', { name: 'Write walkthrough', exact: true })
      .click();
    await expect
      .element(page.getByRole('heading', { name: /One call is yours/ }))
      .toBeVisible();
    await page
      .getByRole('button', { name: 'See the code for step 1', exact: true })
      .click();
    const branch = page.getByRole('region', {
      name: 'Branch code',
      exact: true,
    });
    const working = page.getByRole('region', {
      name: 'Uncommitted code',
      exact: true,
    });
    if (state !== 'uncommitted') {
      await expect.element(branch).toBeVisible();
      await expect
        .element(branch.getByText('A change to review.', { exact: true }))
        .toBeVisible();
    } else await expect.element(branch).not.toBeInTheDocument();
    if (state !== 'committed') {
      await expect.element(working).toBeVisible();
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
    } else await expect.element(working).not.toBeInTheDocument();
    await expect
      .element(
        page
          .getByRole('toolbar', { name: 'Document controls', exact: true })
          .getByRole('button', { name: 'Comment', exact: true }),
      )
      .not.toBeInTheDocument();
    await page.getByRole('tab', { name: 'Walkthrough', exact: true }).click();
    await page
      .getByRole('button', { name: 'See every changed file', exact: true })
      .click();
    await expect
      .element(page.getByRole('heading', { name: 'All changes', exact: true }))
      .toBeVisible();
    if (state !== 'uncommitted')
      await expect
        .element(branch.getByText('A change to review.', { exact: true }))
        .toBeVisible();
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
    await page.getByRole('tab', { name: 'Walkthrough', exact: true }).click();
    await page
      .getByRole('button', { name: 'Write walkthrough', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'See the code for step 1', exact: true })
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
