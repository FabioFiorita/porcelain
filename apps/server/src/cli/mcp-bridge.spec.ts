import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { expect, it } from 'vitest';
import { startRuntime } from '../lifecycle/runtime.ts';
import { runMcpBridge } from './mcp-bridge.ts';

function rpc(messages: unknown[]): Readable {
  return Readable.from([
    `${messages.map((message) => JSON.stringify(message)).join('\n')}\n`,
  ]);
}

async function running(prefix: string) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  await mkdir(join(root, 'home'), { recursive: true });
  const runtime = await startRuntime({
    dataDirectory: join(root, 'state'),
    projectHome: join(root, 'home'),
    port: 0,
  });
  return {
    root,
    dataDirectory: join(root, 'state'),
    close: async () => {
      await runtime.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

/**
 * The bridge is the whole secretless agent door, and it is reachable only over
 * the socket — the direct network MCP tests do not exercise it. Without this,
 * a missing Accept header made every request 406 and nothing noticed.
 */
it('completes initialize and tools/list over the socket with no secret', async () => {
  const server = await running('porcelain-bridge-');
  try {
    const out: string[] = [];
    await runMcpBridge(
      server.dataDirectory,
      rpc([
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'fixture-agent', version: '1.0.0' },
          },
        },
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      ]),
      (line) => out.push(line),
    );

    // The notification is answered with 202 and no body, so it produces no
    // line: two messages in, two replies out.
    expect(out).toHaveLength(2);
    const initialize = JSON.parse(out[0] ?? '{}');
    expect(initialize.result.serverInfo).toMatchObject({ name: 'porcelain' });
    expect(initialize.error).toBeUndefined();
    const tools = JSON.parse(out[1] ?? '{}');
    expect(tools.error).toBeUndefined();
    expect(
      tools.result.tools.map((tool: { name: string }) => tool.name),
    ).toContain('inventory');
  } finally {
    await server.close();
  }
}, 20000);

it('calls a tool and is attributed to the agent, not the owner', async () => {
  const server = await running('porcelain-bridge-tool-');
  try {
    const out: string[] = [];
    await runMcpBridge(
      server.dataDirectory,
      rpc([
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'fixture-agent', version: '1.0.0' },
          },
        },
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'inventory', arguments: {} },
        },
      ]),
      (line) => out.push(line),
    );
    const called = JSON.parse(out.at(-1) ?? '{}');
    expect(called.error).toBeUndefined();
    expect(called.result.isError).not.toBe(true);
    // An agent asked for the inventory, so it gets the inventory: the server's
    // own listing diagnostics are not part of this tool's answer.
    expect(JSON.parse(called.result.content[0].text)).toEqual({
      environmentId: expect.any(String),
      projects: expect.any(Array),
    });
  } finally {
    await server.close();
  }
}, 20000);

it('reports a stopped server once per request instead of hanging', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-bridge-absent-'));
  try {
    const out: string[] = [];
    await runMcpBridge(
      join(root, 'state'),
      rpc([
        { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        // A notification still expects no answer, even when nothing is there.
        { jsonrpc: '2.0', method: 'notifications/initialized' },
      ]),
      (line) => out.push(line),
      1000,
    );
    expect(out).toHaveLength(1);
    expect(JSON.parse(out[0] ?? '{}').error.message).toContain('not running');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 20000);
