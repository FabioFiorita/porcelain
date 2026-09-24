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
  worktreeNotFound,
} from '../scripts/fixture.ts';

const draft = (session: Session, body: unknown) => ({
  method: 'POST' as const,
  path: gitPath(session, '/commit-draft'),
  body,
});
const unprocessable = (message: string) =>
  apiError(422, 'Unprocessable Entity', message);

export default defineFeature({
  feature: 'git-actions.generate-commit-draft',
  reaches: `POST ${gitRoute}/commit-draft`,
  paired: true,
  intent: 'observed',
  behaviour:
    'The owner asks a coding command-line tool to draft a commit message (or a grouping into several commits) for selected changed files, stating the status token they saw. The server captures the selected diffs, refuses if the worktree moved or a path is not a readable change, then runs the chosen model. The isolated server has only Git on its PATH, so only the refusals are verifiable here: an unknown model form, a tool that is not installed, a stale status, a path that is not a change.',
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
          apiError(409, 'Conflict', 'Refresh status and retry inspection'),
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
  ],
});
