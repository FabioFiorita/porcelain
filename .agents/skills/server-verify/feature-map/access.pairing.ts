import {
  listAccessResponseSchema,
  redeemPairingResponseSchema,
} from '@porcelain/contracts/access';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  type Session,
} from '../scripts/feature.ts';
import { issuePairing } from '../scripts/fixture.ts';

const invalidLink = apiError(
  401,
  'Unauthorized',
  'This pairing link is not valid.',
);

async function access(session: Session) {
  return record(
    (await session.send({ method: 'GET', path: '/access', target: 'owner' }))
      .body,
  );
}

export default defineFeature({
  feature: 'access.pairing',
  reaches: ['POST /api/pair'],
  paired: false,
  intent: 'observed',
  behaviour:
    'A device redeems a one-time pairing code the owner issued and becomes a paired device. A native client receives its credential in the body; a browser (request header `x-porcelain-browser: 1`) receives it only as an HttpOnly device cookie. The code is consumed by redemption, and an unknown or reused code is refused without revealing why. A blank or control-character device name or platform is refused without consuming the code.',
  cases: [
    defineCase({
      name: 'native client redeems a code',
      setup: (session) => issuePairing(session, 'Phone'),
      request: (_session, code) => ({
        method: 'POST',
        path: '/api/pair',
        auth: 'none',
        body: { code, platform: 'iOS' },
      }),
      async expect({ response, session, check, checkPartial, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', redeemPairingResponseSchema, response.body);
        const body = record(response.body);
        checkPartial(
          'device',
          { label: 'Phone', platform: 'iOS' },
          body.device,
        );
        check('credential is returned', 'string', typeof body.credential);
        check(
          'no cookie for a native client',
          undefined,
          response.headers['set-cookie'],
        );
        const reading = await session.send({
          method: 'GET',
          path: '/api/inventory',
          auth: { bearer: String(body.credential) },
        });
        check('credential authenticates', 200, reading.status);
        const owner = await access(session);
        checkContract('owner access contract', listAccessResponseSchema, owner);
        check('grant is consumed', [], owner.grants);
        check(
          'device is listed',
          true,
          list(owner.devices).some(
            (device) => record(device).id === record(body.device).id,
          ),
        );
      },
    }),
    defineCase({
      name: 'browser redeems a code',
      setup: (session) => issuePairing(session, 'Laptop'),
      request: (_session, code) => ({
        method: 'POST',
        path: '/api/pair',
        auth: 'none',
        headers: { 'x-porcelain-browser': '1' },
        body: { code, platform: 'Browser', label: 'Work laptop' },
      }),
      expect({ response, check, checkPartial }) {
        check('status', 200, response.status);
        const body = record(response.body);
        checkPartial(
          'device takes the submitted label',
          { label: 'Work laptop', platform: 'Browser' },
          body.device,
        );
        check('no credential in the body', false, 'credential' in body);
        check(
          'credential is an HttpOnly cookie on /api',
          true,
          /^porcelain_device=[^;]+; Path=\/api; HttpOnly; SameSite=Strict; Max-Age=7776000$/.test(
            response.headers['set-cookie'] ?? '',
          ),
        );
      },
    }),
    defineCase({
      name: 'reused code',
      async setup(session) {
        const code = await issuePairing(session);
        await session.send({
          method: 'POST',
          path: '/api/pair',
          auth: 'none',
          body: { code, platform: 'Once' },
        });
        return code;
      },
      request: (_session, code) => ({
        method: 'POST',
        path: '/api/pair',
        auth: 'none',
        body: { code, platform: 'Twice' },
      }),
      expect({ response, check }) {
        check('status', 401, response.status);
        check('error body', invalidLink, response.body);
      },
    }),
    defineCase({
      name: 'invalid device details',
      setup: (session) => issuePairing(session, 'Watch'),
      request: (_session, code) => [
        {
          method: 'POST',
          path: '/api/pair',
          auth: 'none',
          body: { code, platform: 'watchOS\u0007' },
        },
        {
          method: 'POST',
          path: '/api/pair',
          auth: 'none',
          body: { code, platform: 'watchOS', label: '   ' },
        },
        {
          method: 'POST',
          path: '/api/pair',
          auth: 'none',
          body: { code, platform: 'watchOS' },
        },
      ],
      expect({ responses, check, checkPartial }) {
        for (const [index, response] of responses.slice(0, 2).entries()) {
          check(`request ${index + 1} status`, 400, response.status);
          check(
            `request ${index + 1} error body`,
            apiError(
              400,
              'Bad Request',
              'The device name or platform is missing, too long, or contains control characters.',
            ),
            response.body,
          );
        }
        check('the code still redeems', 200, responses[2]?.status);
        checkPartial(
          'device',
          { label: 'Watch', platform: 'watchOS' },
          record(responses[2]?.body).device,
        );
      },
    }),
    defineCase({
      name: 'unknown code',
      request: () => ({
        method: 'POST',
        path: '/api/pair',
        auth: 'none',
        body: { code: 'pcp_unknown', platform: 'iOS' },
      }),
      expect({ response, check }) {
        check('status', 401, response.status);
        check('error body', invalidLink, response.body);
      },
    }),
    defineCase({
      name: 'invalid input',
      request: () => [
        {
          method: 'POST',
          path: '/api/pair',
          auth: 'none',
          body: { code: '', platform: 'iOS' },
        },
        {
          method: 'POST',
          path: '/api/pair',
          auth: 'none',
          body: { code: 'pcp_x' },
        },
        {
          method: 'POST',
          path: '/api/pair',
          auth: 'none',
          body: { code: 'pcp_x', platform: 'iOS', extra: true },
        },
        {
          method: 'POST',
          path: '/api/pair',
          auth: 'none',
          rawBody: '{',
          contentType: 'application/json',
        },
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 400, response.status);
          check(
            `request ${index + 1} error body`,
            invalidRequest,
            response.body,
          );
        }
      },
    }),
  ],
});
