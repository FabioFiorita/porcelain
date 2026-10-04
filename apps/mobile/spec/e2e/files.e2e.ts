import { expect } from './fixtures.ts';
import { filesProof, test } from './files-fixtures.ts';

test('Files browses native read-only text, handles unreadable and missing files, reloads disk changes and resets when the environment changes', async ({
  app,
  files,
}) => {
  expect(await filesProof({ app, files })).toEqual({
    text: 'const greeting = "Restored on disk";\n',
    editRequests: 0,
    reads: [
      '/api/worktrees/:worktreeId/directory',
      '/api/worktrees/:worktreeId/paths',
      '/api/worktrees/:worktreeId/text',
    ],
    missingRead: true,
  });
});
