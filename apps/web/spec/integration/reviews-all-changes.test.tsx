import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('all changes includes every changed file, including unexplained, deleted and spec files', async ({
  workspace,
  agent,
  server,
  repo,
}) => {
  await agent.publishArchitecture();
  await repo.remove('packages/workspace/src/actor.ts');
  const spec = 'tests/publish-note.spec.ts';
  await repo.write(spec, `${await repo.read(spec)}\n// Follow-up spec edit.\n`);
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  const drawer = workspace.getByRole('dialog', {
    name: 'Worktree review',
    exact: true,
  });
  await drawer.getByRole('tab', { name: 'Review', exact: true }).click();
  await drawer
    .getByRole('button', { name: 'All changes', exact: true })
    .click();
  await expect
    .element(workspace.getByText('5 files', { exact: true }))
    .toBeVisible();
  await workspace
    .getByRole('button', { name: 'Mark all 5 files reviewed', exact: true })
    .click();
  const marks = async () =>
    (await server.reviewedFiles()).marks.map((mark) => mark.path).sort();
  const unmarkAll = workspace.getByRole('button', {
    name: 'Unmark all',
    exact: true,
  });
  await expect.element(unmarkAll).toBeEnabled();
  await expect(marks()).resolves.toEqual([
    'packages/workspace/src/actor.ts',
    'packages/workspace/src/policy.ts',
    'packages/workspace/src/revoke-access.ts',
    'scripts/migrate-workspaces.ts',
    'tests/publish-note.spec.ts',
  ]);
  await unmarkAll.click();
  await expect
    .element(
      workspace.getByRole('button', {
        name: 'Mark all 5 files reviewed',
        exact: true,
      }),
    )
    .toBeEnabled();
  await expect(marks()).resolves.toEqual([]);
});

for (const surface of ['Files', 'History'] as const) {
  test(`a clean worktree keeps Changes open and reaches ${surface} from its panel`, async ({
    repo,
    render,
  }) => {
    await repo.commit('Commit the sample change');
    const workspace = await render.workspace();
    const changes = workspace
      .getByRole('tablist', { name: 'Open documents', exact: true })
      .getByRole('tab', { name: 'Changes', exact: true });
    await expect
      .element(
        workspace.getByRole('heading', {
          name: 'No changes to review',
          exact: true,
        }),
      )
      .toBeVisible();
    await changes.click();
    await userEvent.keyboard('{Alt>}w{/Alt}');
    await expect.element(changes).toBeVisible();
    await expect
      .element(
        workspace.getByRole('button', { name: 'Close Changes', exact: true }),
      )
      .not.toBeInTheDocument();
    await workspace
      .getByRole('button', { name: 'Review', exact: true })
      .click();
    const panel = workspace.getByRole('dialog', {
      name: 'Worktree review',
      exact: true,
    });
    await panel.getByRole('tab', { name: surface, exact: true }).click();
    await expect
      .element(
        panel.getByRole('tab', { name: surface, selected: true, exact: true }),
      )
      .toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect.element(panel).not.toBeInTheDocument();
    await expect
      .element(workspace.getByRole('button', { name: 'Review', exact: true }))
      .toHaveFocus();
    await expect
      .element(
        workspace.getByRole('heading', {
          name: 'No changes to review',
          exact: true,
        }),
      )
      .toBeVisible();
  });
}
