import { generateCommitDraftResponseSchema } from '@porcelain/contracts/git-actions';
import {
  defineCase,
  defineFeature,
  apiError,
  invalidRequest,
  unknownFingerprint,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import {
  changes,
  gitPath,
  gitRoute,
  head,
  worktreeNotFound,
  type Changes,
} from '../scripts/fixture.ts';

const draft = (session: Session, body: unknown) => ({
  method: 'POST' as const,
  path: gitPath(session, '/commit-draft'),
  body,
});
const unprocessable = (message: string) =>
  apiError(422, 'Unprocessable Entity', message);
const groupedPaths = (session: Session) =>
  session.fixture.codingTool.groups.flatMap((group) => group.paths);
const expectedFiles = (state: Changes, paths: readonly string[]) =>
  state.changes.filter((change) => paths.includes(change.path));

async function withCodingTool(session: Session) {
  await session.installCodingTool();
  for (const path of groupedPaths(session))
    if (path !== session.fixture.readme.path)
      await session.writeFile(path, `Notes on ${path}\n`);
  return { ...(await changes(session)), head: await head(session) };
}

export default defineFeature({
  feature: 'git-actions.generate-commit-draft',
  reaches: `POST ${gitRoute}/commit-draft`,
  paired: true,
  intent: 'observed',
  behaviour:
    "The owner asks a coding command-line tool to draft a commit message (or a grouping into several commits) for selected changed files, stating the status token they saw. The server captures the selected diffs, refuses if the worktree moved or a path is not a readable change, then runs the chosen model and returns its groups with the fingerprints of the files it drafted from. A draft must use every selected path exactly once, in one group when a message was asked for; otherwise it is refused. The isolated server starts with only Git on its PATH, so an unknown model form and a tool that is not installed are refused first; the later cases install the fixture's coding tool, which answers every drafting prompt with the same message or grouping and fails for a model it does not serve.",
  cases: [
    defineCase({
      name: 'the selected tool is not installed',
      setup: changes,
      request: (session, state) =>
        draft(session, {
          mode: 'message',
          model: 'claude:sonnet',
          expectedStatusToken: state.statusToken,
          paths: ['README.md'],
        }),
      expect({ response, check }) {
        check('status', 422, response.status);
        check(
          'error body',
          unprocessable('The selected coding CLI is not installed.'),
          response.body,
        );
      },
    }),
    defineCase({
      name: 'unsupported model',
      setup: changes,
      request: (session, state) => [
        draft(session, {
          mode: 'message',
          model: 'other:model',
          expectedStatusToken: state.statusToken,
          paths: ['README.md'],
        }),
        draft(session, {
          mode: 'groups',
          model: 'claude:default',
          expectedStatusToken: state.statusToken,
          paths: ['README.md'],
        }),
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 422, response.status);
          check(
            `request ${index + 1} error body`,
            unprocessable('Unsupported commit model.'),
            response.body,
          );
        }
      },
    }),
    defineCase({
      name: 'stale status or a path that is not a change',
      setup: changes,
      request: (session, state) => [
        draft(session, {
          mode: 'message',
          model: 'claude:sonnet',
          expectedStatusToken: unknownFingerprint,
          paths: ['README.md'],
        }),
        draft(session, {
          mode: 'message',
          model: 'claude:sonnet',
          expectedStatusToken: state.statusToken,
          paths: ['missing.md'],
        }),
      ],
      expect({ responses, check }) {
        check('stale status', 409, responses[0]?.status);
        check(
          'stale error body',
          apiError(
            409,
            'Conflict',
            'Refresh status and retry inspection',
            'worktree_changed',
          ),
          responses[0]?.body,
        );
        check('not a change status', 422, responses[1]?.status);
        check(
          'not a change error body',
          unprocessable(
            'Select readable changed files to generate a commit draft.',
          ),
          responses[1]?.body,
        );
      },
    }),
    defineCase({
      name: 'invalid input or unknown worktree',
      request: (session) => [
        draft(session, {
          mode: 'poem',
          model: 'claude:sonnet',
          expectedStatusToken: unknownFingerprint,
          paths: ['README.md'],
        }),
        draft(session, {
          mode: 'message',
          model: 'claude:sonnet',
          expectedStatusToken: unknownFingerprint,
          paths: [],
        }),
        {
          method: 'POST',
          path: gitPath(session, '/commit-draft', {
            worktreeId: unknownWorktreeId,
          }),
          body: {
            mode: 'message',
            model: 'claude:sonnet',
            expectedStatusToken: unknownFingerprint,
            paths: ['README.md'],
          },
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
    defineCase({
      name: 'a message drafted for the selected change',
      setup: withCodingTool,
      request: (session, state) =>
        draft(session, {
          mode: 'message',
          model: 'claude:sonnet',
          expectedStatusToken: state.statusToken,
          paths: [session.fixture.readme.path],
        }),
      async expect({ response, state, session, check, checkContract }) {
        check('status', 200, response.status);
        check(
          'drafted message',
          {
            groups: [session.fixture.codingTool.message],
            expectedFiles: expectedFiles(state, [session.fixture.readme.path]),
          },
          response.body,
        );
        checkContract(
          'contract',
          generateCommitDraftResponseSchema,
          response.body,
        );
        check('nothing committed', state.head, await head(session));
      },
    }),
    defineCase({
      name: 'a grouping drafted for the selected changes',
      setup: withCodingTool,
      request: (session, state) =>
        draft(session, {
          mode: 'groups',
          model: 'claude:haiku',
          expectedStatusToken: state.statusToken,
          paths: groupedPaths(session),
        }),
      expect({ response, state, session, check, checkContract }) {
        check('status', 200, response.status);
        check(
          'drafted groups',
          {
            groups: session.fixture.codingTool.groups,
            expectedFiles: expectedFiles(state, groupedPaths(session)),
          },
          response.body,
        );
        checkContract(
          'contract',
          generateCommitDraftResponseSchema,
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a draft that leaves a selected path out, or a model the tool does not serve',
      setup: withCodingTool,
      request: (session, state) => [
        draft(session, {
          mode: 'message',
          model: 'claude:sonnet',
          expectedStatusToken: state.statusToken,
          paths: groupedPaths(session),
        }),
        draft(session, {
          mode: 'message',
          model: 'claude:retired',
          expectedStatusToken: state.statusToken,
          paths: [session.fixture.readme.path],
        }),
      ],
      expect({ responses, check }) {
        check('uncovered selection status', 422, responses[0]?.status);
        check(
          'uncovered selection error body',
          unprocessable(
            'The generated groups did not cover the selected files. Generate again or write the message manually.',
          ),
          responses[0]?.body,
        );
        check('failing tool status', 422, responses[1]?.status);
        check(
          'failing tool error body',
          unprocessable(
            'Commit generation failed. Check that the selected CLI is up to date and signed in.',
          ),
          responses[1]?.body,
        );
      },
    }),
  ],
});
