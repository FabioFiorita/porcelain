import { expect } from 'vitest';
import { test } from '../kit/journey';

const subjects = async (
  read: () => Promise<{ commits: { subject: string }[] }>,
) => (await read()).commits.map((commit) => commit.subject);

test('History shows a commit made on disk above the start of history, and the server lists it as the newest commit', async ({
  pairedPage,
  repo,
  server,
}) => {
  const subject = 'Commit made on disk';
  await repo.branch('before-commit');
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'History' }).click();
  const initial = pairedPage.getByRole('button', {
    name: repo.initialCommit,
    exact: false,
  });
  await expect.element(initial).toBeVisible();
  await expect.element(pairedPage.getByText('Start of history.')).toBeVisible();

  await repo.commit(subject);
  const tip = pairedPage.getByRole('button', { name: subject, exact: false });
  await expect.element(tip).toBeVisible();
  await expect
    .element(initial.getByText('before-commit', { exact: true }))
    .toBeVisible();
  await expect
    .poll(() => subjects(server.commits))
    .toEqual([subject, repo.initialCommit]);
});

test('switching the worktree to a branch without that commit drops it from History', async ({
  pairedPage,
  repo,
  server,
}) => {
  await repo.switch('before-commit');
  await expect
    .element(
      pairedPage.getByRole('button', {
        name: 'Commit made on disk',
        exact: false,
      }),
    )
    .not.toBeInTheDocument();
  await expect
    .element(
      pairedPage.getByRole('button', {
        name: repo.initialCommit,
        exact: false,
      }),
    )
    .toBeVisible();
  await expect
    .poll(() => subjects(server.commits))
    .toEqual([repo.initialCommit]);
});
