import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Context, Effect, Layer } from 'effect';
import { McpSchema, McpServer } from 'effect/ai';
import { reviewMcpHandlers, type ReviewMcpUseCases } from './review-server.ts';
import { expect, it } from 'vitest';
import { openHttpApplication } from '@porcelain/server/kit/http';
import { reviewMcp } from '../protocol/mcp.ts';
import { LIMITS } from '../../config/limits.ts';

function useCases(calls: unknown[]): ReviewMcpUseCases {
  const unused = {
    execute: () => Effect.die(new Error('Unexpected operation')),
  };
  return {
    reviewTools: {
      atWorktreePath: {
        execute: (input) => {
          calls.push({ cwd: input.cwd, request: input.request });
          return input.operation.execute({
            ...input.request,
            worktreeId: 'a0000000-0000-4000-8000-000000000001',
          });
        },
      },
      listCommentThreads: { execute: () => Effect.succeed([]) },
      publishReview: unused,
      readPublishedReview: unused,
      createCommentThread: unused,
      replyToComment: unused,
      updateCommentThread: unused,
    },
  };
}

it('serves native typed tools to MCP SDK clients with strict defaults and an independent cwd on every invocation', async () => {
  const calls: unknown[] = [];
  const http = await openHttpApplication(
    reviewMcp({ limits: LIMITS.http, useCases: useCases(calls) }),
    { kind: 'owner' },
  );
  const first = new Client({ name: 'first-agent', version: '1' });
  const second = new Client({ name: 'second-agent', version: '1' });
  const connect = (client: Client, cwd: string) => {
    const transport = new StreamableHTTPClientTransport(
      new URL('/mcp', http.address),
      { requestInit: { headers: { 'x-porcelain-cwd': cwd } } },
    );
    const connection: Parameters<Client['connect']>[0] = {
      setProtocolVersion: (version) => transport.setProtocolVersion(version),
      start: () => transport.start(),
      send: (message, options) => transport.send(message, options),
      close: () => transport.close(),
    };
    transport.onclose = () => connection.onclose?.();
    transport.onerror = (error) => connection.onerror?.(error);
    transport.onmessage = (message) => connection.onmessage?.(message);
    return client.connect(connection);
  };
  try {
    await connect(first, '/first-worktree');
    await connect(second, '/second-worktree');
    const listed = await first.listTools();
    const comments = listed.tools.find((tool) => tool.name === 'list_comments');
    expect(comments?.inputSchema).toMatchObject({
      type: 'object',
      properties: {
        cwd: { type: 'string', minLength: 1 },
        scope: { enum: ['waiting', 'all'] },
      },
      additionalProperties: false,
    });
    expect(comments?.outputSchema).toMatchObject({
      type: 'object',
      properties: { threads: { type: 'array' } },
    });
    const waiting = await first.callTool({
      name: 'list_comments',
      arguments: {},
    });
    expect(waiting).toMatchObject({
      isError: false,
      structuredContent: { threads: [] },
      content: [{ type: 'text', text: '{"threads":[]}' }],
    });
    await second.callTool({
      name: 'list_comments',
      arguments: { scope: 'all' },
    });
    await first.callTool({ name: 'list_comments', arguments: {} });
    await expect(
      first.callTool({
        name: 'list_comments',
        arguments: { writer: { kind: 'owner' } },
      }),
    ).resolves.toMatchObject({ isError: true });
    await expect(
      first.callTool({ name: 'list_comments', arguments: { cwd: '' } }),
    ).resolves.toMatchObject({ isError: true });
    await expect(
      first.callTool({
        name: 'list_comments',
        arguments: { scope: 'resolved' },
      }),
    ).resolves.toMatchObject({ isError: true });
    expect(calls).toEqual([
      { cwd: '/first-worktree', request: { scope: 'waiting' } },
      { cwd: '/second-worktree', request: { scope: 'all' } },
      { cwd: '/first-worktree', request: { scope: 'waiting' } },
    ]);
  } finally {
    await first.close();
    await second.close();
    await http.close();
  }
});

it.each([
  { name: 'missing', headers: {} },
  { name: 'empty', headers: { 'x-porcelain-cwd': '' } },
])(
  'refuses a $name cwd header as HTTP 400 before invoking any tool',
  async ({ headers }) => {
    const calls: unknown[] = [];
    const http = await openHttpApplication(
      reviewMcp({ limits: LIMITS.http, useCases: useCases(calls) }),
      { kind: 'owner' },
    );

    try {
      const response = await http.send({
        method: 'POST',
        path: '/mcp',
        headers,
        body: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'list_comments', arguments: {} },
        },
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'The x-porcelain-cwd header is required',
      });
      expect(calls).toEqual([]);
    } finally {
      await http.close();
    }
  },
);

it('returns a typed Bad Request from a tool invocation with no HTTP cwd context', async () => {
  const calls: unknown[] = [];
  const result = await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const context = yield* Layer.build(
          reviewMcpHandlers(useCases(calls)).pipe(
            Layer.provideMerge(McpServer.McpServer.layer),
          ),
        );
        const server = Context.get(context, McpServer.McpServer);
        return yield* server
          .callTool({ name: 'list_comments', arguments: {} })
          .pipe(
            Effect.provideService(McpSchema.McpServerClient, {
              clientId: 1,
              protocolVersion: '2025-11-25',
              clientCapabilities: {},
              clientInfo: { name: 'test', version: '1' },
              initializePayload: {
                protocolVersion: '2025-11-25',
                capabilities: {},
                clientInfo: { name: 'test', version: '1' },
              },
              getClient: Effect.die(new Error('Unexpected client access')),
            }),
          );
      }),
    ),
  );
  expect(result).toMatchObject({
    isError: true,
    content: [
      {
        type: 'text',
        text: '{"statusCode":400,"error":"Bad Request","message":"The x-porcelain-cwd header is required"}',
      },
    ],
  });
  expect(calls).toEqual([]);
});
