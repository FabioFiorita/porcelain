import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  commentThreadsSchema,
  createCommentThreadSchema,
} from '@porcelain/contracts/comments';
import { inventoryResponseSchema } from '@porcelain/contracts/inventory';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

describe('Playground workflow', () => {
  it.each(['SIGINT', 'SIGTERM'] as const)(
    'starts a review server, accepts a file comment and removes its data on %s',
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
        address: string;
        tokenFile: string;
        worktreeId: string;
        projectId: string;
        reviewCommitOid: string;
      };
      const address = info.address;
      const token = await readFile(info.tokenFile, 'utf8');
      expect(output.stdout).not.toContain(token);
      const headers = {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      };
      const inventory = inventoryResponseSchema.parse(
        await (await fetch(`${address}/inventory`, { headers })).json(),
      );
      expect(inventory.projects[0]?.worktrees).toHaveLength(2);
      const base = `${address}/worktrees/${info.worktreeId}`;
      const seededThreads = commentThreadsSchema.parse(
        await (await fetch(`${base}/comments`, { headers })).json(),
      );
      expect(seededThreads[0]?.messages).toHaveLength(2);
      expect(seededThreads[0]?.anchor.filePath).toBe('src/task-store.mjs');
      expect(
        await (await fetch(`${base}/review-layers`, { headers })).json(),
      ).toMatchObject({
        layers: [
          {
            title: 'Prepare release documentation',
            files: [
              { path: 'docs/release-checklist.md' },
              { path: 'docs/accessibility.md' },
              { path: 'README.md' },
            ],
          },
          {
            title: 'Polish the board',
            files: [{ path: 'src/styles.css' }, { path: 'README.md' }],
          },
        ],
      });
      expect(
        await (
          await fetch(
            `${address}/projects/${info.projectId}/commits/${info.reviewCommitOid}/review-layers`,
            { headers },
          )
        ).json(),
      ).toMatchObject({
        commitOid: info.reviewCommitOid,
        layers: [{ files: [{ path: 'docs/review-guide.md' }] }],
      });
      expect(
        await (
          await fetch(
            `${address}/projects/${info.projectId}/file-preferences`,
            { headers },
          )
        ).json(),
      ).toMatchObject({
        preferences: expect.arrayContaining([
          { path: 'src', pinned: true, hidden: false },
          { path: '.cache', pinned: false, hidden: true },
        ]),
      });
      const artifacts = (await (
        await fetch(`${base}/artifacts`, { headers })
      ).json()) as { id: string; name: string }[];
      expect(artifacts[0]?.name).toBe('Launch review report');
      expect(
        await (
          await fetch(`${base}/artifacts/${artifacts[0]?.id}`, { headers })
        ).json(),
      ).toMatchObject({
        content: expect.stringContaining('Fieldnotes launch review'),
      });
      const route = '/worktrees/{worktreeId}/comments';
      const example = createCommentThreadSchema.parse({
        anchor: { kind: 'file', filePath: 'src/task-store.mjs' },
        body: 'Check the completion count when the board is empty.',
      });
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
      const threads = commentThreadsSchema.parse(await created.json());
      const thread = threads.find((entry) => entry.id !== seededThreads[0]?.id);
      expect(thread?.messages[0]?.body).toBe(example.body);
      expect(
        commentThreadsSchema.parse(
          await (await fetch(url, { headers })).json(),
        ),
      ).toEqual([...seededThreads, ...threads]);
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
