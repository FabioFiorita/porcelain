import { expect, test } from './fixtures.ts';
import { prepareHistory } from './history-fixture.ts';

test('History opens selected worktree commits, changed paths and returns to the list', async ({
  app,
  environments,
}) => {
  const environment = await environments.start('History');
  const state = await prepareHistory(environment);
  expect(
    await app.run('history.yaml', {
      PAIRING_LINK: environment.link,
      ENVIRONMENT_NAME: environment.name,
      PROJECT_NAME: state.projectName,
      WORKTREE_LABEL: state.worktreeLabel,
      HISTORY_LINK: app.link('/history'),
      README_PATH: state.readme,
      ROOT_OID: state.root,
      UPDATE_OID: state.update,
      RENAME_OID: state.rename,
      ORIGINAL_WORKTREE: state.originalWorktree,
    }),
  ).toEqual({
    name: 'Browse commits and changed files in History',
    status: 'passed',
  });
  expect(
    (await environment.nativeHits('GET', '/api/worktrees/:worktreeId/commits'))
      .length,
  ).toBeGreaterThanOrEqual(1);
  const files = await environment.nativeHits(
    'GET',
    '/api/worktrees/:worktreeId/commits/:oid/files',
  );
  expect(
    files.map((hit) => hit.path.split('/commits/')[1]?.split('/')[0]),
  ).toEqual([state.rename, state.update, state.root, state.root]);
  const diffs = await environment.nativeHits(
    'POST',
    '/api/worktrees/:worktreeId/commits/:oid/diffs',
  );
  expect(
    diffs.map((hit) => hit.path.split('/commits/')[1]?.split('/')[0]),
  ).toEqual([state.rename, state.update, state.root]);
});
