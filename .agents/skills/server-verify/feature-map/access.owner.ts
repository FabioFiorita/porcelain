import {
  issuePairingResponseSchema,
  listAccessResponseSchema,
  readOwnerStatusResponseSchema,
} from '../../../../packages/contracts/src/access/index.ts';
import {
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  unauthenticated,
  type HttpRequest,
} from '../scripts/feature.ts';
import { pairDevice } from '../scripts/fixture.ts';

const owner = (request: Omit<HttpRequest, 'target'>): HttpRequest => ({
  ...request,
  target: 'owner',
});
const mcpHeaders = (cwd: string) => ({
  accept: 'application/json, text/event-stream',
  'x-porcelain-cwd': cwd,
});

export default defineFeature({
  feature: 'access.owner',
  reaches: [
    'owner GET /status',
    'owner GET /access',
    'owner POST /pairings',
    'owner POST /access/revoke',
    'owner POST /mcp',
    'owner GET /mcp',
  ],
  intent: 'observed',
  behaviour:
    "The owner socket is the machine owner's local control surface; reaching it is the authorization. It reports where the server runs, lists pairing grants and devices, issues one-time pairing codes for the server's addresses, revokes a grant or a device (a revoked device's credential stops working), and serves the review MCP endpoint over POST only.",
  cases: [
    defineCase({
      name: 'status',
      request: () => owner({ method: 'GET', path: '/status' }),
      expect({ response, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', readOwnerStatusResponseSchema, response.body);
        check('address', session.address, record(response.body).address);
        check('not cacheable', 'no-store', response.headers['cache-control']);
      },
    }),
    defineCase({
      name: 'list access',
      request: () => owner({ method: 'GET', path: '/access' }),
      expect({ response, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', listAccessResponseSchema, response.body);
        check('no open grants', [], record(response.body).grants);
        check(
          'the fixture device',
          [{ label: 'Development setup', platform: 'Development' }],
          list(record(response.body).devices).map((device) => ({
            label: record(device).label,
            platform: record(device).platform,
          })),
        );
      },
    }),
    defineCase({
      name: 'issue a pairing',
      request: (session) =>
        owner({
          method: 'POST',
          path: '/pairings',
          body: { labels: ['Tablet'], addresses: [session.address] },
        }),
      async expect({ response, session, check, checkPartial, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', issuePairingResponseSchema, response.body);
        const grant = record(list(record(response.body).grants)[0]);
        checkPartial(
          'grant',
          { label: 'Tablet', addresses: [session.address] },
          grant.grant,
        );
        check(
          'link opens the pairing page',
          true,
          String(grant.link).startsWith(`${session.address}/pair#c=`),
        );
        const access = record(
          (await session.send(owner({ method: 'GET', path: '/access' }))).body,
        );
        checkContract('access contract', listAccessResponseSchema, access);
        check(
          'grant is listed',
          [record(grant.grant).id],
          list(access.grants).map((entry) => record(entry).id),
        );
      },
    }),
    defineCase({
      name: 'issue a pairing with invalid input',
      request: () => [
        owner({
          method: 'POST',
          path: '/pairings',
          body: { labels: [], addresses: [] },
        }),
        owner({
          method: 'POST',
          path: '/pairings',
          body: { labels: ['x'], addresses: ['not a url'] },
        }),
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
    defineCase({
      name: 'revoke a device',
      setup: (session) => pairDevice(session, 'Revoked device'),
      request: (_session, device) =>
        owner({
          method: 'POST',
          path: '/access/revoke',
          body: { id: device.deviceId },
        }),
      async expect({ response, state, session, check }) {
        check('status', 200, response.status);
        check('body', { revoked: true, kind: 'device' }, response.body);
        const reading = await session.send({
          method: 'GET',
          path: '/api/inventory',
          auth: { bearer: state.credential },
        });
        check('revoked credential is refused', 401, reading.status);
        check('revoked credential error body', unauthenticated, reading.body);
        const kept = await session.send({
          method: 'GET',
          path: '/api/inventory',
        });
        check('other devices keep access', 200, kept.status);
      },
    }),
    defineCase({
      name: 'revoke a grant',
      async setup(session) {
        const issued = record(
          (
            await session.send(
              owner({
                method: 'POST',
                path: '/pairings',
                body: { labels: ['Unused'], addresses: [session.address] },
              }),
            )
          ).body,
        );
        return String(record(record(list(issued.grants)[0]).grant).id);
      },
      request: (_session, grantId) =>
        owner({
          method: 'POST',
          path: '/access/revoke',
          body: { id: grantId },
        }),
      async expect({ response, state, session, check }) {
        check('body', { revoked: true, kind: 'grant' }, response.body);
        const access = record(
          (await session.send(owner({ method: 'GET', path: '/access' }))).body,
        );
        check(
          'grant is gone',
          false,
          list(access.grants).some((grant) => record(grant).id === state),
        );
      },
    }),
    defineCase({
      name: 'revoke an unknown ID or invalid input',
      request: () => [
        owner({
          method: 'POST',
          path: '/access/revoke',
          body: { id: 'unknown' },
        }),
        owner({ method: 'POST', path: '/access/revoke', body: { id: '' } }),
      ],
      expect({ responses, check }) {
        check('unknown status', 200, responses[0]?.status);
        check('unknown body', { revoked: false }, responses[0]?.body);
        check('invalid status', 400, responses[1]?.status);
        check('invalid error body', invalidRequest, responses[1]?.body);
      },
    }),
    defineCase({
      name: 'review MCP endpoint',
      request: (session) => [
        owner({
          method: 'POST',
          path: '/mcp',
          headers: mcpHeaders(session.repository),
          body: {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2025-06-18',
              capabilities: {},
              clientInfo: { name: 'verify', version: '1' },
            },
          },
        }),
        owner({
          method: 'POST',
          path: '/mcp',
          headers: mcpHeaders(session.repository),
          body: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
        }),
      ],
      expect({ responses, check, checkPartial }) {
        const [initialized, tools] = responses;
        check('initialize status', 200, initialized?.status);
        checkPartial(
          'server identity',
          {
            jsonrpc: '2.0',
            id: 1,
            result: { serverInfo: { name: 'porcelain' } },
          },
          initialized?.body,
        );
        check('tools status', 200, tools?.status);
        check(
          'review tools',
          [
            'create_comment',
            'list_comments',
            'publish_review',
            'read_review',
            'reply_to_comment',
            'resolve_comment',
          ],
          list(record(record(tools?.body).result).tools)
            .map((tool) => String(record(tool).name))
            .sort(),
        );
      },
    }),
    defineCase({
      name: 'review MCP endpoint refuses other methods',
      request: () => owner({ method: 'GET', path: '/mcp' }),
      expect({ response, check }) {
        check('status', 405, response.status);
        check('allow header', 'POST', response.headers.allow);
      },
    }),
  ],
});
