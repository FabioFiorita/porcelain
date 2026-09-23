import { readCommitDiffsResponseSchema } from '../../../../packages/contracts/src/changes/index.ts';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  record,
  unknownOid,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import {
  threeCommits,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

const diffs = (session: Session, oid: string, body: unknown) => ({
  method: 'POST' as const,
  path: worktreePath(session, `/commits/${oid}/diffs`),
  body,
});

export default defineFeature({
  feature: 'changes.read-commit-diffs',
  reaches: 'POST /api/worktrees/:worktreeId/commits/:oid/diffs',
  intent: 'intended',
  behaviour:
    'A reviewer reads the diffs of chosen paths in one commit, each path given alone or as an old and new pair for a rename, against a chosen parent. A pure rename has a metadata-only patch; a path the commit did not touch has an empty metadata-only patch. An unknown commit and a parent the commit does not have are refused exactly as the commit files read refuses them.',
  cases: [
    defineCase({
      name: 'modified file and pure rename',
      setup: threeCommits,
      request: (session, state) => [
        diffs(session, state.second, { paths: [['README.md']] }),
        diffs(session, state.rename, { paths: [['README.md', 'GUIDE.md']] }),
      ],
      expect({ responses, state, check, checkContract }) {
        check(
          'statuses',
          [200, 200],
          responses.map((entry) => entry.status),
        );
        checkContract(
          'contract',
          readCommitDiffsResponseSchema,
          responses[0]?.body,
        );
        check(
          'modified patch',
          {
            commitOid: state.second,
            diffs: [
              {
                paths: ['README.md'],
                content: {
                  kind: 'text',
                  patch:
                    'diff --git a/README.md b/README.md\nindex 8a69292..90c6866 100644\n--- a/README.md\n+++ b/README.md\n@@ -1 +1,3 @@\n # Sample repository\n+\n+A change to review.\n',
                },
              },
            ],
          },
          responses[0]?.body,
        );
        check(
          'rename patch',
          {
            commitOid: state.rename,
            diffs: [
              {
                paths: ['README.md', 'GUIDE.md'],
                content: {
                  kind: 'metadata-only',
                  patch:
                    'diff --git a/README.md b/GUIDE.md\nsimilarity index 100%\nrename from README.md\nrename to GUIDE.md\n',
                },
              },
            ],
          },
          responses[1]?.body,
        );
      },
    }),
    defineCase({
      name: 'a path the commit did not touch',
      setup: async (session) => (await session.git('rev-parse', 'HEAD')).trim(),
      request: (session, head) =>
        diffs(session, head, { paths: [['untouched.md']] }),
      expect({ response, check }) {
        check('status', 200, response.status);
        check(
          'empty metadata-only patch',
          [
            {
              paths: ['untouched.md'],
              content: { kind: 'metadata-only', patch: '' },
            },
          ],
          record(response.body).diffs,
        );
      },
    }),
    defineCase({
      name: 'unknown commit or a parent the commit does not have',
      setup: async (session) => (await session.git('rev-parse', 'HEAD')).trim(),
      request: (session, head) => [
        diffs(session, unknownOid, { paths: [['README.md']] }),
        diffs(session, head, { parent: 2, paths: [['README.md']] }),
      ],
      expect({ responses, check }) {
        check('unknown commit status', 404, responses[0]?.status);
        check(
          'unknown commit error body',
          apiError(404, 'Not Found', 'Commit not found'),
          responses[0]?.body,
        );
        check('missing parent status', 400, responses[1]?.status);
        check(
          'missing parent error body',
          apiError(400, 'Bad Request', 'Invalid history request'),
          responses[1]?.body,
        );
      },
    }),
    defineCase({
      name: 'invalid input or unknown worktree',
      request: (session) => [
        diffs(session, unknownOid, { paths: [] }),
        diffs(session, unknownOid, { paths: [['a', 'b', 'c']] }),
        {
          method: 'POST',
          path: `/api/worktrees/${unknownWorktreeId}/commits/${unknownOid}/diffs`,
          body: { paths: [['README.md']] },
        },
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.slice(0, 2).entries()) {
          check(`invalid request ${index + 1} status`, 400, response.status);
          check(
            `invalid request ${index + 1} error body`,
            invalidRequest,
            response.body,
          );
        }
        check('unknown worktree status', 404, responses[2]?.status);
        check(
          'unknown worktree error body',
          worktreeNotFound,
          responses[2]?.body,
        );
      },
    }),
  ],
});
