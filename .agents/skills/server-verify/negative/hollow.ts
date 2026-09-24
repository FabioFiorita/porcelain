import { z } from 'zod';
import {
  defineCase,
  defineFeature,
  record,
  unknownWorktreeId,
} from '../scripts/feature.ts';

const unknownChanges = () => ({
  method: 'GET' as const,
  path: `/api/worktrees/${unknownWorktreeId}/changes`,
});

export default defineFeature({
  feature: 'hollow',
  reaches: 'GET /api/worktrees/:worktreeId/changes',
  paired: false,
  intent: 'observed',
  behaviour:
    'Five cases that look like assertions but take nothing from the server: each copies, invents or computes the value it claims to check. The run must judge every one weak.',
  cases: [
    defineCase({
      name: 'expected copied from actual',
      request: unknownChanges,
      expect({ response, check }) {
        check('status', response.status, response.status);
        check('body', response.body, response.body);
      },
    }),
    defineCase({
      name: 'differs from a made-up value',
      request: unknownChanges,
      expect({ response, checkDiffers }) {
        checkDiffers('body', 'sentinel', response.body);
      },
    }),
    defineCase({
      name: 'schema that accepts anything',
      request: unknownChanges,
      expect({ response, checkContract }) {
        checkContract('body', z.unknown(), response.body);
      },
    }),
    defineCase({
      name: 'computed boolean next to a real value',
      request: unknownChanges,
      expect({ response, check }) {
        const body = record(response.body);
        check(
          'body',
          { refused: true, statusCode: 404 },
          { refused: body.statusCode !== 200, statusCode: body.statusCode },
        );
      },
    }),
    defineCase({
      name: 'literal credited by substring',
      request: unknownChanges,
      expect({ check }) {
        check('body', 'Not', 'Not');
      },
    }),
  ],
});
