import { expect } from 'vite-plus/test';
import { test } from '../kit/server-test.ts';

test.for(['PUT', 'DELETE'] as const)(
  'the retired push registration route returns 404 for %s',
  async (method, { session }) => {
    const response = await session.send({
      method,
      path: '/api/push-registration',
      ...(method === 'PUT'
        ? {
            body: {
              token: 'ExponentPushToken[fixture]',
              platform: 'android',
              kinds: [],
            },
          }
        : {}),
    });

    expect(response.status).toBe(404);
  },
);
