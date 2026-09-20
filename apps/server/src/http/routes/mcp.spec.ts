import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { commentThreadsSchema } from '@porcelain/contracts/comments';
import { projectResponseSchema } from '@porcelain/contracts/inventory';
import { expect, it } from 'vitest';
import { createServer } from '../server.ts';

it('serves MCP tools with agent attribution, revision checks and explicit bearer authentication', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-mcp-'));
  const path = join(root, 'repo');
  await mkdir(path);
  execFileSync('git', ['init', '-b', 'main', path], { stdio: 'ignore' });
  const token = 'fixture-token-with-at-least-32-characters';
  const headers = { authorization: `Bearer ${token}` };
  const server = await createServer({
    dataDirectory: join(root, 'state'),
    projectHome: join(root, 'state'),
    token,
  });
  const client = new Client({ name: 'fixture-agent', version: '1.0.0' });
  try {
    const project = projectResponseSchema.parse(
      (
        await server.inject({
          method: 'POST',
          url: '/api/projects',
          headers,
          payload: { path },
        })
      ).json(),
    );
    const worktreeId = project.worktrees[0]?.id;
    if (!worktreeId) throw new Error('Missing worktree');
    const address = await server.listen({ host: '127.0.0.1', port: 0 });
    expect(
      (
        await fetch(`${address}/api/mcp`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await fetch(`${address}/api/mcp`, {
          method: 'POST',
          headers: {
            ...headers,
            origin: address,
            'content-type': 'application/json',
          },
          body: '{}',
        })
      ).status,
    ).toBe(403);
    const transport = new StreamableHTTPClientTransport(
      new URL(`${address}/api/mcp`),
      { requestInit: { headers } },
    );
    await client.connect(transport as Parameters<typeof client.connect>[0]);
    expect((await client.listTools()).tools.map((tool) => tool.name)).toContain(
      'create_comment',
    );
    const created = await client.callTool({
      name: 'create_comment',
      arguments: {
        worktreeId,
        anchor: { kind: 'file', filePath: 'a.ts' },
        body: 'Please review this boundary.',
      },
    });
    expect(created.isError).not.toBe(true);
    const threads = commentThreadsSchema.parse(
      (
        await server.inject({
          method: 'GET',
          url: `/api/worktrees/${worktreeId}/comments`,
          headers,
        })
      ).json(),
    );
    const threadId = threads[0]?.id;
    expect(threads[0]?.messages[0]?.author).toBe('agent');
    await server.inject({
      method: 'POST',
      url: `/api/worktrees/${worktreeId}/comments/${threadId}/replies`,
      headers,
      payload: { body: 'Explain the choice.' },
    });
    await client.callTool({
      name: 'reply_to_comment',
      arguments: {
        worktreeId,
        threadId,
        body: 'It keeps operations separate from persistence.',
      },
    });
    await client.callTool({
      name: 'resolve_comment',
      arguments: { worktreeId, threadId, resolved: true },
    });
    const listed = await client.callTool({
      name: 'list_comments',
      arguments: { worktreeId },
    });
    expect(JSON.stringify(listed)).toContain('reviewer');
    expect(JSON.stringify(listed)).toContain('It keeps operations');
    const spoofed = await client.callTool({
      name: 'create_comment',
      arguments: {
        worktreeId,
        anchor: { kind: 'file', filePath: 'b.ts' },
        body: 'spoof',
        author: 'reviewer',
      },
    });
    expect(spoofed.isError).toBe(true);
    const layers = [
      {
        id: randomUUID(),
        title: 'Boundary',
        files: [{ path: 'a.ts', scope: 'unstaged' }],
      },
    ];
    expect(
      (
        await client.callTool({
          name: 'replace_layers',
          arguments: { worktreeId, expectedRevision: 0, layers },
        })
      ).isError,
    ).not.toBe(true);
    expect(
      (
        await client.callTool({
          name: 'replace_layers',
          arguments: { worktreeId, expectedRevision: 0, layers },
        })
      ).isError,
    ).toBe(true);
    expect(
      (
        await client.callTool({
          name: 'publish_artifact',
          arguments: {
            worktreeId,
            name: 'handoff.md',
            content: 'Boundary cleanup.\n\n- ✓ focused tests',
          },
        })
      ).isError,
    ).not.toBe(true);
  } finally {
    await client.close();
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
