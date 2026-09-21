import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { pairThroughSocket } from '../apps/server/src/development/pair-through-socket.ts';
import { startRuntime } from '../apps/server/src/lifecycle/runtime.ts';
import { commentThreadsSchema } from '../packages/contracts/src/comments.ts';
import { projectResponseSchema } from '../packages/contracts/src/inventory.ts';

it('round-trips publication, reviewer feedback and revision through the real agent command', async () => {
  const root = await mkdtemp(join(tmpdir(), 'p-review-'));
  const repository = join(root, 'repo');
  const state = join(root, 'state');
  const git = async (...args: string[]) =>
    (await promisify(execFile)('git', ['-C', repository, ...args])).stdout;
  await promisify(execFile)('git', ['init', '-b', 'main', repository]);
  await writeFile(
    join(repository, 'behavior.ts'),
    'export const answer = 1;\n',
  );
  await git('add', '.');
  await git(
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.test',
    'commit',
    '-m',
    'Base',
  );
  await writeFile(
    join(repository, 'behavior.ts'),
    'export const answer = 2;\n',
  );
  const runtime = await startRuntime({
    dataDirectory: state,
    projectHome: root,
    port: 0,
  });
  try {
    const token = await pairThroughSocket(
      runtime.socketPath,
      runtime.address,
      'Roundtrip fixture',
    );
    const request = async (path: string, body?: unknown) => {
      const response = await fetch(`${runtime.address}/api${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      expect(response.ok).toBe(true);
      return response.json();
    };
    const project = projectResponseSchema.parse(
      await request('/projects', { path: repository }),
    );
    const worktreeId = project.worktrees[0]?.id;
    if (!worktreeId) throw new Error('Missing fixture worktree');
    const main = resolve('apps/server/src/cli/main.ts');
    const tool = async (name: string, args: unknown = {}) => {
      const child = spawn(
        process.execPath,
        [
          '--input-type=module',
          '--eval',
          `import { runCli } from ${JSON.stringify(main)}; await runCli(['mcp', '--data-directory', ${JSON.stringify(state)}]);`,
        ],
        { cwd: repository, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      let output = '';
      let errors = '';
      child.stdout.on('data', (chunk) => {
        output += chunk;
      });
      child.stderr.on('data', (chunk) => {
        errors += chunk;
      });
      const completion = new Promise<void>((resolve, reject) => {
        child.on('error', reject);
        child.on('exit', (code) =>
          code === 0 ? resolve() : reject(new Error(errors)),
        );
      });
      child.stdin.end(
        `${[
          {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: { name: 'review-fixture', version: '1' },
            },
          },
          { jsonrpc: '2.0', method: 'notifications/initialized' },
          {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: { name, arguments: args },
          },
        ]
          .map((message) => JSON.stringify(message))
          .join('\n')}\n`,
      );
      await completion;
      const response = output
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
        .find((message) => message.id === 2);
      expect(response?.error).toBeUndefined();
      expect(response?.result.isError, JSON.stringify(response)).not.toBe(true);
      return JSON.parse(response.result.content[0].text);
    };
    expect(await tool('read_review')).toBeNull();
    const publication = {
      expectedRevision: 0,
      summaryHtml: '<h1>Explain the answer</h1><a href="#layer-1">Behavior</a>',
      layers: [
        {
          id: randomUUID(),
          title: 'Answer',
          summary: 'The answer now returns two.',
          lanes: ['Code'],
          steps: [
            {
              id: randomUUID(),
              lane: 0,
              title: 'Return two',
              text: 'The exported answer is two.',
              kind: 'changed',
              pointer: { path: 'behavior.ts', startLine: 1, endLine: 1 },
            },
          ],
        },
      ],
    };
    const published = await tool('publish_review', publication);
    expect(published.revision).toBe(1);
    expect(published.notExplained).toEqual([]);
    const summary = await fetch(`${runtime.address}${published.summary.url}`);
    expect(await summary.text()).toContain('Explain the answer');
    const [thread] = commentThreadsSchema.parse(
      await request(`/worktrees/${worktreeId}/comments`, {
        anchor: { kind: 'file', filePath: 'behavior.ts' },
        body: 'Explain why two is correct.',
      }),
    );
    if (!thread) throw new Error('Missing created thread');
    expect(await tool('list_comments')).toContainEqual(
      expect.objectContaining({ id: thread.id }),
    );
    await tool('reply_to_comment', {
      threadId: thread.id,
      body: 'Two represents the two supported inputs.',
    });
    const comments = commentThreadsSchema.parse(
      await request(`/worktrees/${worktreeId}/comments`),
    );
    expect(comments[0]?.messages.at(-1)).toMatchObject({
      author: 'agent',
      body: 'Two represents the two supported inputs.',
    });
    const revised = await tool('publish_review', {
      ...publication,
      expectedRevision: 1,
      summaryHtml: '<h1>Two supported inputs</h1>',
    });
    expect(revised.revision).toBe(2);
    expect(
      (await fetch(`${runtime.address}${published.summary.url}`)).status,
    ).toBe(404);
    await git('add', '.');
    await git(
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.test',
      'commit',
      '-m',
      'Reviewed answer',
    );
    expect(await tool('read_review')).toMatchObject({
      revision: 2,
      active: false,
    });
  } finally {
    await runtime.close();
    await rm(root, { recursive: true, force: true });
  }
}, 20_000);
