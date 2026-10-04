import { FilesFixture } from '../kit/files.ts';
import { expect, test as base } from './fixtures.ts';

export const test = base.extend('files', async ({ environments }) => {
  const first = await FilesFixture.create(
    await environments.start('Files first'),
    'const greeting = "Olá 🌿";\n// **literal**, <tag> and indentation\n  greeting;\n',
  );
  const second = await FilesFixture.create(
    await environments.start('Files second'),
    'const greeting = "Second environment";\n',
  );
  return { first, second };
});

export async function filesProof({
  app,
  files,
}: {
  app: {
    run: (
      flow: string,
      variables?: Record<string, string>,
    ) => Promise<{ name: string; status: 'passed' | 'failed' }>;
    link: (screen: string) => string;
  };
  files: { first: FilesFixture; second: FilesFixture };
}) {
  const { first, second } = files;
  expect(
    await app.run('files-browse.yaml', {
      FIRST_PAIRING_LINK: first.environment.link,
      FIRST_ENVIRONMENT_NAME: first.environment.name,
      FIRST_PROJECT_NAME: first.projectName,
      FIRST_WORKTREE_LABEL: first.worktreeLabel,
      SECOND_PAIRING_LINK: second.environment.link,
      SECOND_ENVIRONMENT_NAME: second.environment.name,
      FILES_LINK: app.link('/files'),
    }),
  ).toEqual({
    name: 'Browse Files through the selected workspace',
    status: 'passed',
  });
  await first.session.writeFile(
    'files-demo/source.ts',
    'const greeting = "Reloaded from disk";\n',
  );
  expect(await app.run('files-reload.yaml')).toEqual({
    name: 'Reload changed file text',
    status: 'passed',
  });
  await first.session.remove('files-demo/source.ts');
  expect(await app.run('files-missing.yaml')).toEqual({
    name: 'A deleted file clears its old content and keeps the way back',
    status: 'passed',
  });
  await first.session.writeFile(
    'files-demo/source.ts',
    'const greeting = "Restored on disk";\n',
  );
  expect(await app.run('files-recover.yaml')).toEqual({
    name: 'Read a restored file again',
    status: 'passed',
  });
  expect(
    await app.run('files-switch.yaml', {
      FIRST_PROJECT_NAME: first.projectName,
      FIRST_WORKTREE_LABEL: first.worktreeLabel,
      SECOND_ENVIRONMENT_NAME: second.environment.name,
      SECOND_PROJECT_NAME: second.projectName,
      SECOND_WORKTREE_LABEL: second.worktreeLabel,
    }),
  ).toEqual({
    name: 'A changed environment resets the selected file',
    status: 'passed',
  });
  return first.result();
}
