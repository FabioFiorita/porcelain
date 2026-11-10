import { expect } from 'vitest';
import { apiError } from '../kit/answers.ts';

import { test } from '../kit/server-test.ts';

const REGISTRATION_PATH = '/api/push-registration';

test('the desktop app cannot register for phone notifications', async ({
  session,
}) => {
  const response = await session.send({
    method: 'PUT',
    path: REGISTRATION_PATH,
    auth: 'desktop',
    body: {
      token: 'ExponentPushToken[desktop]',
      platform: 'ios',
      kinds: [],
    },
  });

  expect(response.status).toBe(403);
  expect(response.body).toStrictEqual(
    apiError(
      403,
      'Forbidden',
      'Notifications are registered by a paired device',
    ),
  );
});

test('a paired device can clear its registration repeatedly', async ({
  session,
}) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await session.send({
      method: 'DELETE',
      path: REGISTRATION_PATH,
    });
    expect(response.status).toBe(204);
    expect(response.body).toBeUndefined();
  }
});
