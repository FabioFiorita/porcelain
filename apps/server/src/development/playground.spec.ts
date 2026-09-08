import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  commentThreadsSchema,
  createCommentThreadSchema,
} from '@porcelain/contracts/comments';
import { inventoryResponseSchema } from '@porcelain/contracts/inventory';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { z } from 'zod';

describe('Playground workflow', () => {
  it.each(['SIGINT', 'SIGTERM'] as const)(
    'starts an explorable server, accepts a documented comment and removes its data on %s',
    async (signal) => {
      const child = spawn(
        process.execPath,
        [new URL('./playground.ts', import.meta.url).pathname],
        {
          env: { PATH: process.env.PATH },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      const output = { stdout: '', stderr: '' };
      child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
        output.stdout += chunk;
      });
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
        output.stderr += chunk;
      });
      const exited = new Promise<number | null>((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      });
      onTestFinished(async () => {
        if (child.exitCode === null && child.signalCode === null)
          child.kill('SIGTERM');
        await vi.waitFor(
          () =>
            expect(child.exitCode !== null || child.signalCode !== null).toBe(
              true,
            ),
          { timeout: 5000 },
        );
        await exited;
      });
      await vi.waitFor(
        () => expect(output.stdout, output.stderr).toContain('\n'),
        { timeout: 10000 },
      );
      const info = JSON.parse(output.stdout.trim()) as {
        documentation: string;
        tokenFile: string;
        worktreeId: string;
      };
      const address = new URL(info.documentation).origin;
      const token = await readFile(info.tokenFile, 'utf8');
      expect(output.stdout).not.toContain(token);
      const headers = {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      };
      expect((await fetch(info.documentation)).status).toBe(200);
      const document = z
        .object({
          paths: z.object({
            '/worktrees/{worktreeId}/comments': z.object({
              post: z.object({
                requestBody: z.object({
                  content: z.object({
                    'application/json': z.object({
                      example: createCommentThreadSchema,
                    }),
                  }),
                }),
              }),
            }),
          }),
        })
        .parse(await (await fetch(`${address}/documentation/json`)).json());
      const inventory = inventoryResponseSchema.parse(
        await (await fetch(`${address}/inventory`, { headers })).json(),
      );
      expect(inventory.projects[0]?.worktrees).toHaveLength(2);
      const route = '/worktrees/{worktreeId}/comments';
      const example =
        document.paths[route].post.requestBody.content['application/json']
          .example;
      const url = `${address}${route.replace('{worktreeId}', info.worktreeId)}`;
      expect(
        (
          await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(example),
          })
        ).status,
      ).toBe(401);
      const created = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(example),
      });
      expect(created.status).toBe(200);
      const [thread] = commentThreadsSchema.parse(await created.json());
      expect(thread?.messages[0]?.body).toBe(example.body);
      expect(
        commentThreadsSchema.parse(
          await (await fetch(url, { headers })).json(),
        ),
      ).toEqual([thread]);
      child.kill(signal);
      await vi.waitFor(() => expect(child.exitCode).toBe(0), { timeout: 5000 });
      expect(await exited).toBe(0);
      await expect(access(dirname(info.tokenFile))).rejects.toMatchObject({
        code: 'ENOENT',
      });
    },
    20000,
  );
});
