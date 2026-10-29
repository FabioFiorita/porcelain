import { expect, test } from './fixtures.tsx';

test.for([
  'refs/heads/heads/x',
  'heads/x',
  'x',
  'refs/tags/release',
  'experiment/a-long-nested-branch-name-that-must-remain-intact-in-commit-details',
])(
  'opening a commit preserves the literal branch decoration %s',
  async (branch, { repo, render }) => {
    await repo.branch(branch);
    const workspace = await render.workspace();
    await workspace
      .getByRole('button', { name: 'Review', exact: true })
      .click();
    await workspace.getByRole('tab', { name: 'History', exact: true }).click();
    await workspace.getByRole('button', { name: /^Initial commit/ }).click();
    await expect
      .element(
        workspace.getByRole('heading', {
          name: 'Initial commit',
          exact: true,
        }),
      )
      .toBeVisible();
    await expect
      .element(workspace.getByText(branch, { exact: true }))
      .toBeVisible();
  },
);

test('opening the root commit shows its added file and patch against the empty tree', async ({
  workspace,
  repo,
}) => {
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'History', exact: true }).click();
  await workspace.getByRole('button', { name: /^Initial commit/ }).click();
  await expect
    .element(
      workspace.getByRole('heading', { name: 'Initial commit', exact: true }),
    )
    .toBeVisible();
  await expect
    .element(workspace.getByText('root commit', { exact: true }))
    .toBeVisible();
  await expect
    .element(workspace.getByText('1 file changed', { exact: true }))
    .toBeVisible();
  await expect
    .element(workspace.getByText(repo.readme.committed.trim(), { exact: true }))
    .toBeVisible();
  await workspace.screenshot({
    path: '../../test-results/integration/screenshots/root-commit.png',
  });
});

test('opening a commit leads with its subject and summarizes its files before their diffs', async ({
  workspace,
  repo,
  server,
}) => {
  const subject = 'Explain the change to review';
  await repo.commit(subject);
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(subject);
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'History', exact: true }).click();
  await workspace
    .getByRole('button', { name: new RegExp(`^${subject}`) })
    .click();
  await expect
    .element(
      workspace.getByRole('heading', { name: subject, exact: true, level: 1 }),
    )
    .toBeVisible();
  await expect
    .element(workspace.getByText('1 file changed', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      workspace
        .getByRole('list', { name: 'Changed files', exact: true })
        .getByText('README.md', { exact: true }),
    )
    .toBeVisible();
  const changedFiles = workspace.getByRole('list', {
    name: 'Changed files',
    exact: true,
  });
  await expect
    .element(changedFiles.getByText('+2', { exact: true }))
    .toBeVisible();
  await expect
    .element(changedFiles.getByText('−0', { exact: true }))
    .toBeVisible();
  const [commit] = (await server.commits()).commits;
  if (!commit) throw new Error('The committed change must be listed');
  await expect
    .element(
      workspace.getByRole('tab', {
        name: `${commit.oid.slice(0, 7)} ${subject}`,
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(workspace.getByText('A change to review.', { exact: true }))
    .toBeVisible();
});

test('a binary file in a commit is listed without a code preview and says it is a binary change', async ({
  workspace,
  repo,
  server,
}) => {
  const subject = 'Add a binary logo';
  const logo = 'logo.bin';
  await repo.write(logo, 'PNG\u0000\u0001\u0002binary');
  await repo.commit(subject);
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(subject);
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'History', exact: true }).click();
  await workspace
    .getByRole('button', { name: new RegExp(`^${subject}`) })
    .click();
  await expect
    .element(workspace.getByRole('heading', { name: subject, exact: true }))
    .toBeVisible();
  const withoutPreview = workspace.getByRole('list', {
    name: 'Changes without code preview',
    exact: true,
  });
  await expect
    .element(withoutPreview.getByText(logo, { exact: true }))
    .toBeVisible();
  await expect
    .element(withoutPreview.getByText('added · Binary change', { exact: true }))
    .toBeVisible();
});

test('a retained commit only names the checkout branch while its history contains that commit', async ({
  repo,
  server,
  render,
}) => {
  await repo.branch('topic');
  await repo.switch('topic');
  await repo.commit('Keep this commit open');
  const workspace = await render.workspace();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'History', exact: true }).click();
  await workspace
    .getByRole('button', { name: /^Keep this commit open/ })
    .click();
  await expect
    .element(workspace.getByText('on topic', { exact: true }))
    .toBeVisible();
  await repo.switch(repo.initialBranch);
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe('Initial commit');
  await expect
    .element(workspace.getByText('on topic', { exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(
      workspace.getByRole('heading', {
        name: 'Keep this commit open',
        exact: true,
      }),
    )
    .toBeVisible();
});

test('the checkout branch appears in the eyebrow while a same-named tag remains in commit details', async ({
  repo,
  render,
}) => {
  await repo.tag(repo.initialBranch);
  const workspace = await render.workspace();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'History', exact: true }).click();
  await workspace.getByRole('button', { name: /^Initial commit/ }).click();
  await expect
    .element(workspace.getByText(`on ${repo.initialBranch}`, { exact: true }))
    .toBeVisible();
  await expect
    .element(workspace.getByText('root commit', { exact: true }))
    .toBeVisible();
  const names = workspace
    .getByRole('region', { name: 'Review content', exact: true })
    .getByText(repo.initialBranch, { exact: true });
  await expect.element(names.nth(1)).toBeVisible();
  await expect.element(names.nth(2)).not.toBeInTheDocument();
});

test('a binary-only commit retains its subject and file summary without a code preview', async ({
  workspace,
  repo,
  server,
}) => {
  await repo.commit('Commit the initial README change');
  await repo.write('only-binary.bin', 'PNG\u0000binary');
  await repo.commit('Explain a binary-only change');
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe('Explain a binary-only change');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'History', exact: true }).click();
  await workspace
    .getByRole('button', { name: /^Explain a binary-only change/ })
    .click();
  await expect
    .element(
      workspace.getByRole('heading', {
        name: 'Explain a binary-only change',
        exact: true,
        level: 1,
      }),
    )
    .toBeVisible();
  await expect
    .element(workspace.getByText('1 file changed', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      workspace
        .getByRole('list', { name: 'Changed files', exact: true })
        .getByText('only-binary.bin', { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      workspace
        .getByRole('list', { name: 'Changed files', exact: true })
        .getByText('Binary', { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      workspace
        .getByRole('list', {
          name: 'Changes without code preview',
          exact: true,
        })
        .getByText('added · Binary change', { exact: true }),
    )
    .toBeVisible();
});

test('a type change counts every text section of its patch', async ({
  workspace,
  repo,
  server,
}) => {
  await repo.write('mode-change.txt', 'before\n');
  await repo.commit('Prepare a regular file');
  await repo.remove('mode-change.txt');
  await repo.symlink('README.md', 'mode-change.txt');
  await repo.commit('Preserve both sides of a type change');
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe('Preserve both sides of a type change');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'History', exact: true }).click();
  await workspace
    .getByRole('button', { name: /^Preserve both sides of a type change/ })
    .click();
  const summary = workspace.getByRole('list', {
    name: 'Changed files',
    exact: true,
  });
  await expect
    .element(summary.getByText('T', { exact: true }))
    .toHaveAttribute('aria-label', 'type-changed');
  await expect.element(summary.getByText('+1', { exact: true })).toBeVisible();
  await expect.element(summary.getByText('−1', { exact: true })).toBeVisible();
});
