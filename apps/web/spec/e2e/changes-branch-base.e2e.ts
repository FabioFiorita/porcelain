import { expect, test } from './fixtures.ts';

test('a branch deep link keeps valid selections when another optional search value is malformed', async ({
  pairedPage,
  app,
  repo,
  server,
}) => {
  await repo.branch('feature');
  await repo.switch('feature');
  await repo.write('first.md', 'first\n');
  await repo.commit('First on the branch');
  await expect.poll(async () => (await server.branchChanges()).commits).toBe(1);
  const workspace = app.address().path;
  await app.open(
    `${workspace}?surface=changes&scope=branch&base=refs%2Fheads%2Fmain&side=42&entry=%7B%22invalid%22%3Atrue%7D`,
  );
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Changes', exact: true }).click();
  await expect(
    pairedPage.getByRole('tab', { name: 'Changes', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(
    pairedPage.getByRole('tab', { name: 'Branch', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(
    pairedPage.getByText('1 commit on feature since main', { exact: true }),
  ).toBeVisible();
  await expect(
    pairedPage.getByRole('button', { name: 'first.md · added', exact: true }),
  ).toBeVisible();
});
