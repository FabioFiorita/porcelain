import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { expect, it } from 'vitest';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import { runMcpBridge } from './mcp-bridge.ts';

it('keeps the negotiated owner session and protocol across stdio requests', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pc-mcp-bridge-'));
  const headers: unknown[] = [];
  const server = createServer((request, response) => {
    headers.push({
      session: request.headers['mcp-session-id'],
      protocol: request.headers['mcp-protocol-version'],
      cwd: request.headers['x-porcelain-cwd'],
    });
    request.resume();
    request.once('end', () => {
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
    });
  });
  const output: string[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(ownerSocketPath(directory), resolve);
    });
    await runMcpBridge(
      directory,
      1000,
      Readable.from([
        `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' })}\n`,
        `${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`,
      ]),
      (line) => {
        output.push(line);
      },
    );
    expect(headers).toEqual([
      { session: undefined, protocol: undefined, cwd: process.cwd() },
      {
        session: 'negotiated-session',
        protocol: '2025-11-25',
        cwd: process.cwd(),
      },
    ]);
    expect(output.map((line): unknown => JSON.parse(line))).toEqual([
      { jsonrpc: '2.0', id: 1, result: { accepted: true } },
      { jsonrpc: '2.0', id: 2, result: { accepted: true } },
    ]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
});
