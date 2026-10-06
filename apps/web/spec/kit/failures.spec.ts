import { expect, test } from 'vitest';
import { createFailures } from './failures.ts';

test('an undeclared 5xx answer is reported, a declared one is not, and a kit request never counts', () => {
  const failures = createFailures();
  failures.response('POST /probe/actions', 503);

  expect(
    failures.unexpected(
      [],
      [
        {
          method: 'POST',
          route: '/probe/actions',
          path: '/probe/actions',
          kit: false,
          status: 503,
        },
        {
          method: 'GET',
          route: '/probe/inventory',
          path: '/probe/inventory',
          kit: false,
          status: 500,
        },
        {
          method: 'GET',
          route: '/probe/health',
          path: '/probe/health',
          kit: true,
          status: 502,
        },
      ],
    ),
  ).toEqual(['server answered GET /probe/inventory with 500']);
});
