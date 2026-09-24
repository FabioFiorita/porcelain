import {
  issuePairingResponseSchema,
  listAccessResponseSchema,
  readOwnerStatusResponseSchema,
} from '@porcelain/contracts/access';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  text,
  unauthenticated,
  type HttpRequest,
} from '../scripts/feature.ts';
import { mcpHeaders, pairDevice, read } from '../scripts/fixture.ts';

const owner = (request: Omit<HttpRequest, 'target'>): HttpRequest => ({
  ...request,
  target: 'owner',
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
    'owner PUT /mcp',
    'owner PATCH /mcp',
    'owner DELETE /mcp',
  ],
  paired: false,
  intent: 'observed',
  behaviour:
    "The owner socket is the machine owner's local control surface; reaching it is the authorization. It reports where the server runs, lists pairing grants and devices, issues one-time pairing codes for the server's addresses (a request naming an address the server does not answer at, or a blank label, issues nothing), revokes a grant or a device (a revoked device's credential stops working), and serves the review MCP endpoint over POST only. None of it is reachable from the network listener, even with a paired credential: a read there answers the web shell and a write is not found.",
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
      expect({ response, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', listAccessResponseSchema, response.body);
        check('no open grants', [], record(response.body).grants);
        check(
          'the fixture device',
          [session.fixture.device],
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
          `${session.address}/pair#c=`,
          text(grant.link).slice(0, `${session.address}/pair#c=`.length),
        );
        const access = await read(
          session,
          owner({ method: 'GET', path: '/access' }),
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
      name: 'issue a pairing the server cannot honour',
      setup: (session) =>
        read(session, owner({ method: 'GET', path: '/access' })),
      request: (session) => [
        owner({
          method: 'POST',
          path: '/pairings',
          body: {
            labels: ['Tablet'],
            addresses: [session.address, 'http://192.0.2.1:9'],
          },
        }),
        owner({
          method: 'POST',
          path: '/pairings',
          body: { labels: ['Tablet', ' \t '], addresses: [session.address] },
        }),
      ],
      async expect({ responses, state, session, check }) {
        check('unreachable address status', 400, responses[0]?.status);
        check(
          'unreachable address error body',
          apiError(
            400,
            'Bad Request',
            'This server does not answer at that address, so a link aimed there would not reach it.',
          ),
          responses[0]?.body,
        );
        check('blank label status', 400, responses[1]?.status);
        check(
          'blank label error body',
          apiError(
            400,
            'Bad Request',
            'The device name or platform is missing, too long, or contains control characters.',
          ),
          responses[1]?.body,
        );
        check(
          'no grant was issued',
          state,
          await read(session, owner({ method: 'GET', path: '/access' })),
        );
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
        const before = await read(
          session,
          owner({ method: 'GET', path: '/access' }),
        );
        const issued = await read(
          session,
          owner({
            method: 'POST',
            path: '/pairings',
            body: { labels: ['Unused'], addresses: [session.address] },
          }),
        );
        return {
          before,
          grantId: text(record(record(list(issued.grants)[0]).grant).id),
        };
      },
      request: (_session, state) =>
        owner({
          method: 'POST',
          path: '/access/revoke',
          body: { id: state.grantId },
        }),
      async expect({ response, state, session, check }) {
        check('status', 200, response.status);
        check('body', { revoked: true, kind: 'grant' }, response.body);
        const access = await read(
          session,
          owner({ method: 'GET', path: '/access' }),
        );
        check('grant is gone', state.before.grants, access.grants);
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
      request: () =>
        (['GET', 'PUT', 'PATCH', 'DELETE'] as const).map((method) =>
          owner({ method, path: '/mcp' }),
        ),
      expect({ responses, check }) {
        for (const [index, response] of responses.entries()) {
          const method = ['GET', 'PUT', 'PATCH', 'DELETE'][index];
          check(`${method} status`, 405, response.status);
          check(
            `${method} error body`,
            apiError(405, 'Method Not Allowed', 'Method Not Allowed'),
            response.body,
          );
          check(`${method} allow header`, 'POST', response.headers.allow);
        }
      },
    }),
    defineCase({
      name: 'owner routes are absent on the network listener',
      setup: (session) =>
        read(session, owner({ method: 'GET', path: '/access' })),
      request: (session) => [
        { method: 'GET', path: '/status' },
        { method: 'GET', path: '/access' },
        {
          method: 'POST',
          path: '/pairings',
          body: { labels: ['Intruder'], addresses: [session.address] },
        },
        { method: 'POST', path: '/access/revoke', body: { id: 'unknown' } },
        {
          method: 'POST',
          path: '/mcp',
          headers: mcpHeaders(session.repository),
          body: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        },
      ],
      async expect({ responses, state, session, check }) {
        for (const [index, response] of responses.slice(0, 2).entries()) {
          check(`read ${index + 1} status`, 200, response.status);
          check(
            `read ${index + 1} answers the web shell, not the owner`,
            session.fixture.web.shell,
            response.body,
          );
        }
        for (const [index, response] of responses.slice(2).entries()) {
          const request = [
            'POST:/pairings',
            'POST:/access/revoke',
            'POST:/mcp',
          ][index];
          check(`write ${index + 1} status`, 404, response.status);
          check(
            `write ${index + 1} error body`,
            apiError(404, 'Not Found', `Route ${request} not found`),
            response.body,
          );
        }
        check(
          'nothing was issued or revoked',
          state,
          await read(session, owner({ method: 'GET', path: '/access' })),
        );
      },
    }),
  ],
});
