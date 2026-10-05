import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listCommentsToolRequestSchema } from '@porcelain/contracts/reviews';
import { Effect, Schema } from 'effect';
import { expect, it } from 'vitest';
import { registerEffectTool } from './effect-tool.ts';

it('publishes the Effect input shape through the MCP SDK and dispatches its decoded defaults', async () => {
  const server = new McpServer({
    name: 'review-contract-test',
    version: '1.0.0',
  });
  const inputs: unknown[] = [];
  registerEffectTool(
    server,
    {
      name: 'list_comments',
      input: listCommentsToolRequestSchema,
      output: Schema.Struct({ scope: Schema.Literals(['waiting', 'all']) }),
    },
    (input) =>
      Effect.sync(() => {
        inputs.push(input);
        return { scope: input.scope };
      }),
  );
  const client = new Client({ name: 'review-agent', version: '1.0.0' });
  const [agentTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(agentTransport);
    const listed = await client.listTools();
    expect(listed.tools).toHaveLength(1);
    expect(listed.tools[0]?.inputSchema).toMatchObject({
      type: 'object',
      properties: {
        cwd: { type: 'string', minLength: 1 },
        scope: { enum: ['waiting', 'all'] },
      },
      additionalProperties: false,
    });
    const answer = await client.callTool({
      name: 'list_comments',
      arguments: {},
    });
    expect(answer).toEqual({
      content: [{ type: 'text', text: '{"scope":"waiting"}' }],
    });
    const rejected = await client.callTool({
      name: 'list_comments',
      arguments: { scope: 'resolved' },
    });
    expect(rejected.isError).toBe(true);
    const forged = await client.callTool({
      name: 'list_comments',
      arguments: { cwd: '/work/project', writer: { kind: 'owner' } },
    });
    expect(forged.isError).toBe(true);
    const emptyPath = await client.callTool({
      name: 'list_comments',
      arguments: { cwd: '' },
    });
    expect(emptyPath.isError).toBe(true);
    expect(inputs).toEqual([{ scope: 'waiting' }]);
  } finally {
    await client.close();
    await server.close();
  }
});
