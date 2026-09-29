import { expect } from 'vitest';
import { test } from '../kit/journey';

test('History lists each commit message without a graph beside it and marks a merge commit with a merge icon', async ({
  pairedPage,
  repo,
  server,
}) => {
  const topic = 'Add the topic notes';
  const long =
    'Describe every step the reviewer takes before approving the change';
  await repo.branch('topic');
  await repo.switch('topic');
  await repo.write('topic.md', '# Topic\n');
  await repo.commit(topic);
  await repo.switch(repo.initialBranch);
  await repo.write('steps.md', '# Steps\n');
  await repo.commit(long);
  await repo.merge('topic');
  await expect
    .poll(async () => (await server.commits()).commits[0]?.parentOids.length)
    .toBe(2);

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'History' }).click();
  const sidebar = pairedPage.getByRole('complementary', {
    name: 'Review sidebar',
  });
  const merge = sidebar.getByRole('button', {
    name: "Merge branch 'topic'",
    exact: false,
  });
  await expect
    .element(merge.getByRole('img', { name: 'Merge commit' }))
    .toBeVisible();
  const described = sidebar.getByRole('button', { name: long, exact: false });
  await expect
    .element(described.getByText(long, { exact: true }))
    .toBeVisible();
  await expect
    .element(described.getByRole('img', { name: 'Merge commit' }))
    .not.toBeInTheDocument();
  await expect
    .element(
      sidebar
        .getByRole('button', { name: topic, exact: false })
        .getByText('topic', { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(sidebar.getByRole('list', { name: 'Commit graph' }))
    .not.toBeInTheDocument();
  await expect
    .element(sidebar.getByRole('button', { name: 'Open graph' }))
    .toBeVisible();
});
