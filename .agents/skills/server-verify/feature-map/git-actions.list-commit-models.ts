import { listCommitModelsResponseSchema } from '../../../../packages/contracts/src/git-actions/index.ts';
import {
  defineCase,
  defineFeature,
  unauthenticated,
} from '../scripts/feature.ts';

export default defineFeature({
  feature: 'git-actions.list-commit-models',
  reaches: 'GET /api/git/commit-models',
  intent: 'observed',
  behaviour:
    "The owner lists the models that can draft a commit message: those of the Codex and Claude command-line tools found on the server's PATH. The isolated server has neither, so the list is empty; a machine with them lists `codex:<model>` and `claude:sonnet`/`claude:haiku`.",
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
