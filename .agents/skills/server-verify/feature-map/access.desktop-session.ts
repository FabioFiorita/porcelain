import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import {
  defineCase,
  defineFeature,
  unauthenticated,
} from '../scripts/feature.ts';
import { inventory } from '../scripts/fixture.ts';

export default defineFeature({
  feature: 'access.desktop-session',
  reaches: 'GET /api/inventory',
  paired: true,
  intent: 'intended',
  behaviour:
    "The desktop app starts its own server with a private session credential that only that launch knows. A request on the computer itself that carries it is the owner's desktop app and reads paired routes such as the inventory exactly as a paired device does, without pairing. A desktop credential the server did not start with is refused like any other unknown credential, with the same 401 body and a Bearer challenge; a request without a credential is refused by the access.authentication sweep.",
  cases: [
    defineCase({
      name: "the desktop app's session credential reads the inventory",
      setup: inventory,
      request: () => ({
        method: 'GET',
        path: '/api/inventory',
        auth: 'desktop',
      }),
      expect({ response, state, check, checkContract }) {
        check('status', 200, response.status);
        check('same body as the paired read', state, response.body);
        checkContract('contract', readInventoryResponseSchema, response.body);
      },
    }),
    defineCase({
      name: 'a desktop session credential the server did not start with',
      setup: inventory,
      request: () => ({
        method: 'GET',
        path: '/api/inventory',
        auth: { bearer: 'a-previous-launch-desktop-credential' },
      }),
      async expect({ response, state, session, check }) {
        check('status', 401, response.status);
        check('error body', unauthenticated, response.body);
        check('challenge', 'Bearer', response.headers['www-authenticate']);
        check('nothing changed', state, await inventory(session));
      },
    }),
  ],
});
