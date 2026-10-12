import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReviewToolkit } from '@porcelain/contracts/reviews';
import { expect } from 'vitest';
import { apiError } from '../kit/answers.ts';
import { kitHeaders } from '../kit/isolated-server.ts';
import {
  sampleReview,
  toolCall,
  toolResult,
  toolText,
  toolValue,
} from '../kit/requests.ts';
import {
  recordHandlers,
  test,
  writeRouteLog,
  type RouteLog,
} from '../kit/server-test.ts';
import { integrationTeardown } from '../kit/global-setup.ts';
import { record } from '../kit/session.ts';

test('MCP coverage records validated owner handler entry and excludes other traffic', async ({
  session,
  server,
}) => {
  expect(server.tools).toStrictEqual(Object.keys(ReviewToolkit.tools).sort());
  expect(await server.invokedTools()).toStrictEqual([]);
  const constructed = toolCall(session, 30, 'read_review', {});
  expect(await server.invokedTools()).toStrictEqual([]);

  const malformed = await session.send(
    toolCall(session, 31, 'read_review', { cwd: 123 }),
  );
  expect(malformed.status).toBe(200);
  expect(toolResult(malformed.body).isError).toBe(true);
  expect(toolText(malformed.body)).toContain(
    "Invalid parameters for tool 'read_review': Expected string",
  );
  expect(toolText(malformed.body)).toContain('["cwd"]');
  const unknown = await session.send(toolCall(session, 32, 'unknown_tool', {}));
  expect(unknown.status).toBe(200);
  expect(record(unknown.body).error).toMatchObject({
    code: -32602,
    message: "Tool 'unknown_tool' not found",
  });
  const spoofed = await session.send({
    ...constructed,
    headers: { ...constructed.headers, 'mcp-name': 'delete_review' },
  });
  expect(spoofed.status).toBe(400);
  const missingCwd = await session.send({
    ...constructed,
    headers: { ...constructed.headers, 'x-porcelain-cwd': '' },
  });
  expect(missingCwd.status).toBe(400);
  const network = await session.send({ ...constructed, target: 'network' });
  expect(network.status).toBe(404);
  expect(await server.invokedTools()).toStrictEqual([]);

  const [kit, comments] = await Promise.all([
    session.send({
      ...constructed,
      headers: { ...constructed.headers, ...kitHeaders },
    }),
    session.send(toolCall(session, 30, 'list_comments', {})),
  ]);
  expect(kit.status).toBe(200);
  expect(toolResult(kit.body).isError).toBe(false);
  expect(comments.status).toBe(200);
  expect(toolResult(comments.body).isError).toBe(false);
  expect(toolValue(comments.body)).toStrictEqual({ threads: [] });
  expect(await server.invokedTools()).toStrictEqual(['list_comments']);

  const refused = await session.send(
    toolCall(session, 33, 'delete_review', { cwd: session.projectHome }),
  );
  expect(refused.status).toBe(200);
  expect(toolResult(refused.body).isError).toBe(true);
  expect(toolValue(refused.body)).toStrictEqual(
    apiError(
      404,
      'Not Found',
      'No registered Porcelain worktree contains this path',
    ),
  );
  expect(await server.invokedTools()).toStrictEqual([
    'delete_review',
    'list_comments',
  ]);

  const readReview = await session.send(constructed);
  expect(readReview.status).toBe(200);
  expect(toolResult(readReview.body).isError).toBe(false);
  expect(toolValue(readReview.body)).toMatchObject({ review: null });
  expect(await server.invokedTools()).toStrictEqual([
    'delete_review',
    'list_comments',
    'read_review',
  ]);
});

test('the production integration teardown judges recorded MCP handlers only for a complete selection', async ({
  session,
  server,
}) => {
  const threadId = randomUUID();
  const inputs = {
    publish_review: sampleReview(session, 0, randomUUID(), randomUUID()),
    read_review: {},
    delete_review: {},
    list_comments: {},
    create_comment: {
      anchor: { kind: 'file', filePath: 'README.md' },
      body: 'Fixture comment',
    },
    reply_to_comment: { threadId, body: 'Fixture reply' },
    resolve_comment: { threadId, resolved: true },
  } satisfies Record<keyof typeof ReviewToolkit.tools, Record<string, unknown>>;
  for (const [name, input] of Object.entries(inputs)) {
    if (name === 'resolve_comment') continue;
    const response = await session.send(
      toolCall(session, 40, name, { ...input, cwd: session.projectHome }),
    );
    expect(response.status).toBe(200);
    expect(toolResult(response.body).isError).toBe(true);
    expect(toolValue(response.body)).toStrictEqual(
      apiError(
        404,
        'Not Found',
        'No registered Porcelain worktree contains this path',
      ),
    );
  }
  expect(await server.invokedTools()).toStrictEqual(
    Object.keys(ReviewToolkit.tools)
      .filter((name) => name !== 'resolve_comment')
      .sort(),
  );

  const currentFile = fileURLToPath(import.meta.url);
  const folder = dirname(currentFile);
  const files = (await readdir(folder))
    .filter((name) => name.endsWith('.integration.ts'))
    .map((name) => join(folder, name));
  const projectName = '@porcelain/server-integration';
  const modules = files.map((moduleId) => ({
    moduleId,
    project: { name: projectName },
    children: {
      allTests: () =>
        moduleId === currentFile
          ? [{ result: () => ({ state: 'passed' }) }]
          : [],
    },
  }));
  const judge = async (complete: boolean) => {
    const routes = await mkdtemp(join(tmpdir(), 'porcelain-mcp-coverage-'));
    let removedBuild = false;
    try {
      const log: RouteLog = {
        registered: new Set(),
        requested: new Set(),
        registeredTools: new Set(),
        invokedTools: new Set(),
      };
      await recordHandlers(server, log);
      log.registered = new Set(
        [...log.registered].filter((route) => route === 'owner POST /mcp'),
      );
      expect([...log.registered]).toStrictEqual(['owner POST /mcp']);
      await writeRouteLog(routes, log);
      await integrationTeardown(
        {
          name: projectName,
          vitest: {
            state: {
              getTestModules: () =>
                complete
                  ? modules
                  : modules.filter((module) => module.moduleId === currentFile),
            },
          },
        },
        routes,
        {
          remove: async () => {
            removedBuild = true;
          },
        },
      );
    } finally {
      const routesRemain = existsSync(routes);
      await rm(routes, { recursive: true, force: true });
      expect(removedBuild).toBe(true);
      expect(routesRemain).toBe(false);
    }
  };

  await expect(judge(true)).rejects.toThrow(
    'Route coverage: no integration test reached MCP tool resolve_comment;',
  );
  await expect(judge(false)).resolves.toBeUndefined();

  const resolved = await session.send(
    toolCall(session, 41, 'resolve_comment', {
      ...inputs.resolve_comment,
      cwd: session.projectHome,
    }),
  );
  expect(resolved.status).toBe(200);
  expect(toolResult(resolved.body).isError).toBe(true);
  expect(toolValue(resolved.body)).toStrictEqual(
    apiError(
      404,
      'Not Found',
      'No registered Porcelain worktree contains this path',
    ),
  );
  expect(await server.invokedTools()).toStrictEqual(
    Object.keys(ReviewToolkit.tools).sort(),
  );
  await expect(judge(true)).resolves.toBeUndefined();
});
