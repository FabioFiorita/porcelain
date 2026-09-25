import { expect, test } from 'vitest';
import { browserTransport } from '../../src/shared/api/transport';
import { createSessionLive } from '../../src/features/access/api/session-live';

test('access.session: an unpaired browser cannot restore a session', async () => {
  const session = createSessionLive(browserTransport(fetch));
  await expect(session.restore(new AbortController().signal)).rejects.toThrow(
    'No active browser session',
  );
  await expect(session.disconnect()).resolves.toBeUndefined();
  await expect(session.restore(new AbortController().signal)).rejects.toThrow(
    'No active browser session',
  );
});
