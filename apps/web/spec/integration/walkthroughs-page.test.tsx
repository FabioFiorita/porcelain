import { page as browserPage } from 'vitest/browser';
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
    .element(page.getByText('Reading the change', { exact: true }))
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
    .getByRole('button', { name: 'See the code for step 1', exact: true })
    .click();
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
    .element(page.getByText('Updating…', { exact: true }))
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
  await expect
    .poll(async () => (await server.walkthrough()).walkthrough?.id)
    .not.toBe(firstId);
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
    .not.toBeInTheDocument();
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
  await sidebar.getByRole('tab', { name: 'Uncommitted', exact: true }).click();
  await expect
    .element(sidebar.getByText('By step', { exact: true }))
    .toBeVisible();
  const before = (await server.walkthrough()).walkthrough;
  await repo.commit('Commit the explained content');
  const committedHead = (await server.gitStatus()).headOid;
  await expect
    .poll(async () => (await server.walkthrough()).outOfDate)
    .toBe(false);
  await expect
    .element(
      page.getByRole('button', { name: 'Update walkthrough', exact: true }),
    )
    .not.toBeInTheDocument();
  await repo.write('notes.md', 'first line\nsecond line\nnew edit\n');
  await expect
    .element(
      page.getByText('The work changed after this was written.', {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .poll(async () => (await server.walkthrough()).walkthrough?.id)
    .toBe(before?.id);
  await page
    .getByRole('button', { name: 'Update walkthrough', exact: true })
    .click();
  await expect
    .element(
      page.getByText(new RegExp(`written for ${committedHead?.slice(0, 7)}`)),
    )
    .toBeVisible();
  await expect
    .poll(async () => (await server.walkthrough()).walkthrough?.id)
    .not.toBe(before?.id);
  await expect
    .element(page.getByRole('heading', { name: /One call is yours/ }))
    .toBeVisible();
});
