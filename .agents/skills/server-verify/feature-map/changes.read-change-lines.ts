import { readChangeLinesResponseSchema } from '@porcelain/contracts/changes';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  record,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import { worktreeNotFound, worktreePath } from '../scripts/fixture.ts';

const linesOf = (text: string) => text.replace(/\n$/, '').split('\n');
const lines = (session: Session, query: Record<string, string | number>) => ({
  method: 'GET' as const,
  path: worktreePath(session, '/changes/lines'),
  query,
});

export default defineFeature({
  feature: 'changes.read-change-lines',
  reaches: 'GET /api/worktrees/:worktreeId/changes/lines',
  paired: true,
  intent: 'intended',
  behaviour:
    "A reviewer reads a line range of a file either as committed at head or as it is in the worktree, to expand context around a diff. The range is clamped to the file's length and the answer states the range it actually returned. A range that ends before it starts is invalid input.",
  cases: [
    defineCase({
      name: 'worktree and head versions',
      request: (session) => [
        lines(session, {
          path: session.fixture.readme.path,
          from: 1,
          to: 5,
          at: 'worktree',
        }),
        lines(session, {
          path: session.fixture.readme.path,
          from: 1,
          to: 5,
          at: 'head',
        }),
      ],
      expect({ responses, session, check, checkPartial, checkContract }) {
        check(
          'statuses',
          [200, 200],
          responses.map((entry) => entry.status),
        );
        checkContract(
          'contract',
          readChangeLinesResponseSchema,
          responses[0]?.body,
        );
        const worktree = linesOf(session.fixture.readme.changed);
        const committed = linesOf(session.fixture.readme.committed);
        checkPartial(
          'worktree lines',
          {
            worktreeId: session.worktreeId,
            at: 'worktree',
            path: session.fixture.readme.path,
            from: 1,
            to: worktree.length,
            lines: worktree,
          },
          responses[0]?.body,
        );
        checkPartial(
          'head lines are clamped',
          { at: 'head', from: 1, to: committed.length, lines: committed },
          responses[1]?.body,
        );
      },
    }),
    defineCase({
      name: 'reversed range',
      request: (session) =>
        lines(session, {
          path: session.fixture.readme.path,
          from: 5,
          to: 1,
          at: 'head',
        }),
      expect({ response, check }) {
        check('status', 400, response.status);
        check('error body', invalidRequest, response.body);
      },
    }),
    defineCase({
      name: 'a range past the end of the file',
      request: (session) =>
        lines(session, {
          path: session.fixture.readme.path,
          from: 5,
          to: 9,
          at: 'head',
        }),
      expect({ response, check }) {
        check('status', 200, response.status);
        const body = record(response.body);
        check(
          'empty range reported as from..from-1',
          { from: 5, to: 4, lines: [] },
          { from: body.from, to: body.to, lines: body.lines },
        );
      },
    }),
    defineCase({
      name: 'a path that is not in the repository',
      request: (session) => [
        lines(session, { path: 'missing.md', from: 1, to: 2, at: 'head' }),
        lines(session, { path: 'missing.md', from: 1, to: 2, at: 'worktree' }),
      ],
      expect({ responses, check }) {
        check('head status', 422, responses[0]?.status);
        check(
          'head error body',
          apiError(
            422,
            'Unprocessable Entity',
            'Repository could not be inspected',
          ),
          responses[0]?.body,
        );
        check('worktree status', 404, responses[1]?.status);
        check(
          'worktree error body',
          apiError(404, 'Not Found', 'Path not found'),
          responses[1]?.body,
        );
      },
    }),
    defineCase({
      name: 'invalid input or unknown worktree',
      request: (session) => [
        lines(session, { path: 'README.md', from: 0, to: 2, at: 'head' }),
        lines(session, { path: '../outside', from: 1, to: 2, at: 'head' }),
        lines(session, { path: 'README.md', from: 1, to: 2, at: 'index' }),
        {
          method: 'GET',
          path: `/api/worktrees/${unknownWorktreeId}/changes/lines`,
          query: { path: 'README.md', from: 1, to: 2, at: 'head' },
        },
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.slice(0, 3).entries()) {
          check(`invalid request ${index + 1} status`, 400, response.status);
          check(
            `invalid request ${index + 1} error body`,
            invalidRequest,
            response.body,
          );
        }
        check('unknown status', 404, responses[3]?.status);
        check('unknown error body', worktreeNotFound, responses[3]?.body);
      },
    }),
  ],
});
