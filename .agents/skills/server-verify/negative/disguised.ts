import { apiErrorSchema } from '@porcelain/contracts/shared';
import {
  defineCase,
  defineFeature,
  record,
  text,
  unknownWorktreeId,
} from '../scripts/feature.ts';

const unknownChanges = () => ({
  method: 'GET' as const,
  path: `/api/worktrees/${unknownWorktreeId}/changes`,
});

export default defineFeature({
  feature: 'disguised',
  reaches: 'GET /api/worktrees/:worktreeId/changes',
  paired: false,
  intent: 'observed',
  behaviour:
    'Hollow assertions dressed as real ones: an expected value spread from the body, read from a header or wrapped around the body; a contract schema loosened with partial(); a computed boolean inside a list; a word cut from a message; a value that differs from something in the same response. The run must judge every one weak.',
  cases: [
    defineCase({
      name: 'expected value spread from the body',
      request: unknownChanges,
      expect({ response, check }) {
        check('body', { ...record(response.body) }, response.body);
      },
    }),
    defineCase({
      name: 'expected value read from the same header',
      request: unknownChanges,
      expect({ response, check }) {
        check(
          'content type',
          response.headers['content-type'],
          response.headers['content-type'],
        );
      },
    }),
    defineCase({
      name: 'the body wrapped in the expected value',
      request: unknownChanges,
      expect({ response, check }) {
        const body = record(response.body);
        check('wrapped', { wrapped: body }, { wrapped: response.body });
      },
    }),
    defineCase({
      name: 'a contract loosened with partial',
      request: unknownChanges,
      expect({ response, checkContract }) {
        checkContract('body', apiErrorSchema.partial(), response.body);
      },
    }),
    defineCase({
      name: 'a computed boolean inside a list',
      request: unknownChanges,
      expect({ response, check }) {
        const body = record(response.body);
        check(
          'code and message',
          [404, true],
          [body.statusCode, typeof body.message === 'string'],
        );
      },
    }),
    defineCase({
      name: 'a word cut from the message',
      request: unknownChanges,
      expect({ response, check }) {
        check(
          'message',
          'Worktree',
          text(record(response.body).message).split(' ')[0],
        );
      },
    }),
    defineCase({
      name: 'differs from a value in the same response',
      request: unknownChanges,
      expect({ response, checkDiffers }) {
        checkDiffers('status', record(response.body).error, response.status);
      },
    }),
  ],
});
