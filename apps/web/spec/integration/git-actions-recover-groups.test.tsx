import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('a lost grouped-commit response is read once, then the remaining group commits from the recovered HEAD', async ({
  codingTool,
  render,
  repo,
  server,
  fetchGate,
  live,
}) => {
  const traffic = fetchGate.loseNextGitActionResponse();
  const workspace = await render.workspace();
  const { groups } = await codingTool.install();
  await repo.commit('Commit the sample change first');
  for (const group of groups)
    for (const path of group.paths)
      await repo.write(path, `${path} recovered in groups\n`);
  for (const path of groups.flatMap((group) => group.paths))
    await expect
      .element(
        workspace.getByRole('button', {
          name: `Mark ${path} as reviewed`,
          exact: true,
        }),
      )
      .toBeVisible();
  await workspace.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = workspace.getByRole('dialog', {
    name: 'Commit changes',
    exact: true,
  });
  await dialog.getByRole('tab', { name: 'Use groups', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Generate with AI', exact: true })
    .click();
  await expect
    .element(
      dialog.getByRole('textbox', {
        name: 'Message for commit 1',
        exact: true,
      }),
    )
    .toHaveValue(groups[0]?.message ?? '');
  const before = (await server.commits()).commits[0]?.oid;
  live.drop();
  await expect.poll(() => live.connected()).toBe(false);
  await dialog
    .getByRole('button', { name: 'Commit groups in order', exact: true })
    .click();
  await expect
    .element(dialog.getByRole('alert'))
    .toMatchTextContent(/could not reach/i);
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(groups[0]?.message);
  await dialog
    .getByRole('button', { name: 'Check outcome', exact: true })
    .click();
  await expect
    .element(dialog.getByText('Commit 1 · committed', { exact: true }))
    .toBeVisible();
  await expect.poll(() => traffic.writes.length).toBe(1);
  await expect.poll(() => traffic.reads.length).toBe(1);
  live.restore();
  await expect.poll(() => live.connected()).toBe(true);
  await dialog
    .getByRole('button', { name: 'Commit groups in order', exact: true })
    .click();
  await expect
    .element(dialog.getByText('Commit 2 · committed', { exact: true }))
    .toBeVisible();
  await expect
    .poll(async () =>
      (await server.commits()).commits
        .slice(0, 3)
        .map((commit) => commit.subject),
    )
    .toEqual([
      groups[1]?.message,
      groups[0]?.message,
      'Commit the sample change first',
    ]);
  await expect
    .poll(async () => (await server.commits()).commits[2]?.oid)
    .toBe(before);
  await expect.poll(() => traffic.writes.length).toBe(2);
  for (const path of groups.flatMap((group) => group.paths))
    await expect
      .poll(async () => (await server.text(path)).text)
      .toBe(`${path} recovered in groups\n`);
  live.restore();
  await userEvent.keyboard('{Escape}');
});
