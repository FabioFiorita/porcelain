import { expect, test } from './fixtures.tsx';

test('all changes includes every changed file, including unexplained, deleted and spec files', async ({
  workspace,
  agent,
  server,
}) => {
  await agent.publishArchitecture();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  const drawer = workspace.getByRole('dialog', {
    name: 'Worktree review',
    exact: true,
  });
  await drawer.getByRole('tab', { name: 'Review', exact: true }).click();
  await drawer
    .getByRole('button', { name: 'All changes · 55 files', exact: true })
    .click();
  await expect
    .element(workspace.getByText('55 files', { exact: true }))
    .toBeVisible();
  await workspace
    .getByRole('button', { name: 'Mark all 49 files reviewed', exact: true })
    .click();
  const marks = async () =>
    (await server.reviewedFiles()).marks.map((mark) => mark.path).sort();
  const unmarkAll = workspace.getByRole('button', {
    name: 'Unmark all',
    exact: true,
  });
  await expect.element(unmarkAll).toBeEnabled();
  await expect(marks()).resolves.toEqual([
    'apps/server/src/export-history.ts',
    'apps/server/src/invite-member.ts',
    'apps/server/src/publish-note.ts',
    'apps/server/src/reconnect-device.ts',
    'apps/server/src/retry-delivery.ts',
    'apps/server/src/revoke-access.ts',
    'apps/server/src/schedule-reminder.ts',
    'apps/server/src/transfer-workspace.ts',
    'apps/web/src/export-history.ts',
    'apps/web/src/invite-member.ts',
    'apps/web/src/publish-note.ts',
    'apps/web/src/reconnect-device.ts',
    'apps/web/src/retry-delivery.ts',
    'apps/web/src/revoke-access.ts',
    'apps/web/src/schedule-reminder.ts',
    'apps/web/src/transfer-workspace.ts',
    'docs/architecture.md',
    'docs/decisions/export-history.md',
    'docs/decisions/invite-member.md',
    'docs/decisions/publish-note.md',
    'docs/decisions/reconnect-device.md',
    'docs/decisions/retry-delivery.md',
    'docs/decisions/revoke-access.md',
    'docs/decisions/schedule-reminder.md',
    'docs/decisions/transfer-workspace.md',
    'packages/client/src/export-history.ts',
    'packages/client/src/invite-member.ts',
    'packages/client/src/publish-note.ts',
    'packages/client/src/reconnect-device.ts',
    'packages/client/src/retry-delivery.ts',
    'packages/client/src/revoke-access.ts',
    'packages/client/src/schedule-reminder.ts',
    'packages/client/src/transfer-workspace.ts',
    'packages/workspace/src/export-history.ts',
    'packages/workspace/src/invite-member.ts',
    'packages/workspace/src/journal.ts',
    'packages/workspace/src/legacy-write.ts',
    'packages/workspace/src/outbox.ts',
    'packages/workspace/src/policy.ts',
    'packages/workspace/src/publish-note.ts',
    'packages/workspace/src/reconnect-device.ts',
    'packages/workspace/src/retry-delivery.ts',
    'packages/workspace/src/revoke-access.ts',
    'packages/workspace/src/schedule-reminder.ts',
    'packages/workspace/src/sessions.ts',
    'packages/workspace/src/transfer-workspace.ts',
    'scripts/migrate-workspaces.ts',
    'tests/export-history.spec.ts',
    'tests/invite-member.spec.ts',
    'tests/publish-note.spec.ts',
    'tests/reconnect-device.spec.ts',
    'tests/retry-delivery.spec.ts',
    'tests/revoke-access.spec.ts',
    'tests/schedule-reminder.spec.ts',
    'tests/transfer-workspace.spec.ts',
  ]);
  await unmarkAll.click();
  await expect
    .element(
      workspace.getByRole('button', {
        name: 'Mark all 55 files reviewed',
        exact: true,
      }),
    )
    .toBeEnabled();
  await expect(marks()).resolves.toEqual([]);
});
