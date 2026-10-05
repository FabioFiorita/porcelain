import { expect, test } from './fixtures.tsx';

const subjects = async (
  read: () => Promise<{ commits: readonly { subject: string }[] }>,
) => (await read()).commits.map((commit) => commit.subject);

test('History shows a commit made on disk above the start of history, and the server lists it as the newest commit', async ({
  workspace,
  repo,
  server,
}) => {
  const subject = 'Commit made on disk';
  await repo.branch('before-commit');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'History', exact: true }).click();
  const initial = workspace.getByRole('button', {
    name: new RegExp(`^${repo.initialCommit}`),
  });
  await expect.element(initial).toBeVisible();
  await expect
    .element(workspace.getByText('Start of history.', { exact: true }))
    .toBeVisible();

  await repo.commit(subject);
  const tip = workspace.getByRole('button', {
    name: new RegExp(`^${subject}`),
  });
  await expect.element(tip).toBeVisible();
  await expect
    .element(initial.getByText('before-commit', { exact: true }))
    .toBeVisible();
  await expect
    .poll(() => subjects(server.commits))
    .toEqual([subject, repo.initialCommit]);
});

test('switching the worktree to a branch without that commit drops it from History', async ({
  workspace,
  repo,
  server,
}) => {
  await repo.branch('before-commit');
  await repo.commit('Commit made on disk');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'History', exact: true }).click();
  await expect
    .element(workspace.getByRole('button', { name: /^Commit made on disk/ }))
    .toBeVisible();
  await repo.switch('before-commit');
  await expect
    .element(
      workspace.getByRole('button', {
        name: /^Commit made on disk/,
      }),
    )
    .not.toBeInTheDocument();
  await expect
    .element(
      workspace.getByRole('button', {
        name: new RegExp(`^${repo.initialCommit}`),
      }),
    )
    .toBeVisible();
  await expect
    .poll(() => subjects(server.commits))
    .toEqual([repo.initialCommit]);
});
