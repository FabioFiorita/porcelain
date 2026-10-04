import { expect } from './fixtures.ts';
import { filesProof, test } from './files-fixtures.ts';

test('iPad Files browses read-only text, reloads and recovers, and resets across environments', async ({
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
