import { listCommitModelsResponseSchema } from '@porcelain/contracts/git-actions';
import {
  defineCase,
  defineFeature,
  unauthenticated,
} from '../scripts/feature.ts';

export default defineFeature({
  feature: 'git-actions.list-commit-models',
  reaches: 'GET /api/git/commit-models',
  paired: true,
  intent: 'observed',
  behaviour:
    "The owner lists the models that can draft a commit message: those of the Codex and Claude command-line tools found on the server's PATH. The isolated server's PATH starts with only Git, so the list is empty; once the fixture's coding tool is installed as claude, the list holds the Claude models. What Codex lists, from its model cache, is not verified here.",
  cases: [
    defineCase({
      name: 'no model tool installed',
      request: () => ({ method: 'GET', path: '/api/git/commit-models' }),
      expect({ response, check, checkContract }) {
        check('status', 200, response.status);
        check('body', [], response.body);
        checkContract(
          'contract',
          listCommitModelsResponseSchema,
          response.body,
        );
      },
    }),
    defineCase({
      name: 'the Claude command-line tool installed',
      setup: (session) => session.installCodingTool(),
      request: () => ({ method: 'GET', path: '/api/git/commit-models' }),
      expect({ response, check, checkContract }) {
        check('status', 200, response.status);
        check(
          'body',
          [
            { id: 'claude:sonnet', label: 'Sonnet' },
            { id: 'claude:haiku', label: 'Haiku' },
          ],
          response.body,
        );
        checkContract(
          'contract',
          listCommitModelsResponseSchema,
          response.body,
        );
      },
    }),
    defineCase({
      name: 'without a credential',
      request: () => ({
        method: 'GET',
        path: '/api/git/commit-models',
        auth: 'none',
      }),
      expect({ response, check }) {
        check('status', 401, response.status);
        check('error body', unauthenticated, response.body);
      },
    }),
  ],
});
