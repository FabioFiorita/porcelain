import { Effect, Schema } from 'effect';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { expect, it } from 'vitest';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import { runMcpBridge } from './mcp-bridge.ts';

async function relayThroughOwner(
  answer: (
    request: IncomingMessage,
    response: ServerResponse,
    body: string,
  ) => void,
  messages: readonly unknown[],
): Promise<unknown[]> {
  const directory = await mkdtemp(join(tmpdir(), 'pc-mcp-bridge-'));
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.once('end', () =>
      answer(request, response, Buffer.concat(chunks).toString()),
    );
  });
  const output: string[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(ownerSocketPath(directory), resolve);
    });
    await Effect.runPromise(
      runMcpBridge(
        directory,
        1000,
        Readable.from(
          messages.map((message) => `${JSON.stringify(message)}\n`),
        ),
        (line) => {
          output.push(line);
        },
      ),
    );
    return output.map((line): unknown => JSON.parse(line));
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
}

it('keeps the negotiated owner session and protocol across stdio requests', async () => {
  const headers: unknown[] = [];
  const output = await relayThroughOwner(
    (request, response) => {
      headers.push({
        session: request.headers['mcp-session-id'],
        protocol: request.headers['mcp-protocol-version'],
        cwd: request.headers['x-porcelain-cwd'],
      });
      response.writeHead(200, {
        'content-type': 'application/json',
        'mcp-session-id': 'negotiated-session',
        'mcp-protocol-version': '2025-11-25',
      });
      response.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: headers.length,
          result: { accepted: true },
        }),
      );
    },
    [
      { jsonrpc: '2.0', id: 1, method: 'initialize' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    ],
  );
  expect(headers).toEqual([
    { session: undefined, protocol: undefined, cwd: process.cwd() },
    {
      session: 'negotiated-session',
      protocol: '2025-11-25',
      cwd: process.cwd(),
    },
  ]);
  expect(output).toEqual([
    { jsonrpc: '2.0', id: 1, result: { accepted: true } },
    { jsonrpc: '2.0', id: 2, result: { accepted: true } },
  ]);
});

const decodeOwnerMessage = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({
      id: Schema.optional(Schema.Number),
      method: Schema.String,
    }),
  ),
);

it('opens a new owner session when the restarted server no longer knows the old one', async () => {
  const issued = new Set<string>();
  const received: unknown[] = [];
  let restarted = false;
  const output = await relayThroughOwner(
    (request, response, body) => {
      const message = decodeOwnerMessage(body);
      const session = request.headers['mcp-session-id'];
      received.push({ method: message.method, session });
      if (message.id === 3 && !restarted) {
        restarted = true;
        issued.clear();
      }
      if (message.method === 'initialize') {
        const created = `session-${received.length}`;
        issued.add(created);
        response.writeHead(200, {
          'content-type': 'application/json',
          'mcp-session-id': created,
        });
        response.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result: { session: created },
          }),
        );
        return;
      }
      if (typeof session !== 'string' || !issued.has(session)) {
        response.writeHead(404);
        response.end();
        return;
      }
      if (message.id === undefined) {
        response.writeHead(202);
        response.end();
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { session } }),
      );
    },
    [
      { jsonrpc: '2.0', id: 1, method: 'initialize' },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'resources/read' },
    ],
  );
  expect(received).toEqual([
    { method: 'initialize', session: undefined },
    { method: 'notifications/initialized', session: 'session-1' },
    { method: 'tools/list', session: 'session-1' },
    { method: 'resources/read', session: 'session-1' },
    { method: 'initialize', session: undefined },
    { method: 'notifications/initialized', session: 'session-5' },
    { method: 'resources/read', session: 'session-5' },
  ]);
  expect(output).toEqual([
    { jsonrpc: '2.0', id: 1, result: { session: 'session-1' } },
    { jsonrpc: '2.0', id: 2, result: { session: 'session-1' } },
    { jsonrpc: '2.0', id: 3, result: { session: 'session-5' } },
  ]);
});

it('answers a request the owner refuses with an empty body, and leaves a refused notification silent', async () => {
  const output = await relayThroughOwner(
    (_request, response) => {
      response.writeHead(400);
      response.end();
    },
    [
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 7, method: 'tools/list' },
    ],
  );
  expect(output).toEqual([
    {
      jsonrpc: '2.0',
      id: 7,
      error: {
        code: -32000,
        message: 'The Porcelain server refused the request with HTTP 400.',
      },
    },
  ]);
});

it.each([null, 23])(
  'correlates an HTTP 400 JSON-RPC refusal with owner id %s to the request and preserves its error',
  async (ownerId) => {
    const output = await relayThroughOwner(
      (_request, response) => {
        response.writeHead(400, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: ownerId,
            error: {
              code: -32600,
              message: 'Invalid session',
              data: { reason: 'expired' },
            },
          }),
        );
      },
      [{ jsonrpc: '2.0', id: 23, method: 'tools/list' }],
    );
    expect(output).toEqual([
      {
        jsonrpc: '2.0',
        id: 23,
        error: {
          code: -32600,
          message: 'Invalid session',
          data: { reason: 'expired' },
        },
      },
    ]);
  },
);

it('answers an unreachable owner for each request and keeps notifications silent', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pc-mcp-absent-'));
  const output: unknown[] = [];
  try {
    await Effect.runPromise(
      runMcpBridge(
        directory,
        1000,
        Readable.from(
          [
            { jsonrpc: '2.0', method: 'notifications/initialized' },
            { jsonrpc: '2.0', id: 'request', method: 'tools/list' },
          ].map((message) => `${JSON.stringify(message)}\n`),
        ),
        (line) => {
          output.push(JSON.parse(line));
        },
      ),
    );
    expect(output).toEqual([
      {
        jsonrpc: '2.0',
        id: 'request',
        error: { code: -32000, message: 'Porcelain is not running.' },
      },
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
