import { expect, test } from './fixtures.ts';

test('Files browses, edits, creates, renames and trashes real worktree files', async ({
  app,
  environments,
}) => {
  const environment = await environments.start('Files', { workspace: true });
  const projectName = environment.workspace?.projectName;
  if (!projectName) throw new Error('Files proof needs a project.');
  const ids = await environment.server.sampleIds();
  const session = environment.server.session(environment.recorder, ids);
  await session.writeFile(
    'mobile-source.ts',
    'const message = "Before native edit";\n',
  );
  expect(
    await app.run('files.yaml', {
      PAIRING_LINK: environment.link,
      ENVIRONMENT_NAME: environment.name,
      PROJECT_NAME: projectName,
    }),
  ).toEqual({ name: 'Browse and manage files on iPhone', status: 'passed' });
  expect(await session.readFile('mobile-source.ts')).toBe(
    'const message = "After native edit";\n',
  );
  expect(await session.entries('mobile-folder')).toEqual([]);
  expect(
    (
      await environment.nativeHits(
        'GET',
        '/api/worktrees/:worktreeId/directory',
      )
    ).length,
  ).toBeGreaterThan(0);
  expect(
    (await environment.nativeHits('POST', '/api/worktrees/:worktreeId/files'))
      .length,
  ).toBeGreaterThan(0);
});
