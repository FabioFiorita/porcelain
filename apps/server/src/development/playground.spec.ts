import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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
        profile: string;
        worktrees: { path: string; branch: string; role: string }[];
      };
      expect(info.profile).toBe('fixture');
      expect(
        info.worktrees.map(({ branch, role }) => ({ branch, role })),
      ).toEqual([
        { branch: 'main', role: 'main' },
        { branch: 'review', role: 'review' },
      ]);
      const address = info.address;
      const token = await readFile(info.tokenFile, 'utf8');
      expect(output.stdout).not.toContain(token);
      const headers = {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      };
      const inventory = inventoryResponseSchema.parse(
        await (await fetch(`${address}/api/inventory`, { headers })).json(),
      );
      expect(inventory.projects[0]?.worktrees).toHaveLength(2);
      const base = `${address}/api/worktrees/${info.worktreeId}`;
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
            summary:
              'Release documents collect the reviewer-facing checklist and accessibility notes.',
            files: [
              {
                path: 'docs/release-checklist.md',
                note: 'The renamed checklist is the release entry point.',
              },
              {
                path: 'docs/accessibility.md',
                note: 'Captures the keyboard and narrow-screen checks.',
              },
              { path: 'README.md' },
            ],
          },
          {
            title: 'Polish the board',
            summary:
              'Keep the board readable while the release changes are reviewed.',
            files: [{ path: 'src/styles.css' }, { path: 'README.md' }],
          },
        ],
      });
      expect(
        await (
          await fetch(
            `${address}/api/projects/${info.projectId}/commits/${info.reviewCommitOid}/review-layers`,
            { headers },
          )
        ).json(),
      ).toMatchObject({
        commitOid: info.reviewCommitOid,
        layers: [
          {
            summary:
              'The committed guide establishes the order for the release handoff.',
            files: [
              {
                path: 'docs/review-guide.md',
                note: 'The guide is the committed review entry point.',
              },
            ],
          },
        ],
      });
      expect(
        await (
          await fetch(
            `${address}/api/projects/${info.projectId}/file-preferences`,
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
      expect(artifacts.map((artifact) => artifact.name)).toEqual(
        expect.arrayContaining(['handoff.html', 'handoff.md']),
      );
      const report = artifacts.find(
        (artifact) => artifact.name === 'handoff.html',
      );
      expect(
        await (
          await fetch(`${base}/artifacts/${report?.id}`, { headers })
        ).json(),
      ).toMatchObject({
        content: expect.stringContaining('Fieldnotes launch review'),
      });
      const route = '/api/worktrees/{worktreeId}/comments';
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
  it('rejects an unknown profile before creating anything', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'porcelain-profile-'));
    onTestFinished(() => rm(parent, { recursive: true, force: true }));
    const child = spawn(
      process.execPath,
      [new URL('./playground.ts', import.meta.url).pathname],
      {
        env: {
          PATH: process.env.PATH,
          PORCELAIN_PLAYGROUND_PROFILE: 'huge',
          PORCELAIN_PLAYGROUND_DIRECTORY: parent,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let stderr = '';
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });
    const [code] = await once(child, 'close');
    expect(code).toBe(1);
    expect(stderr).toContain('Unknown playground profile "huge"');
    expect(await readdir(parent)).toEqual([]);
  });
  it('seeds the review worktree, not an agent worktree, in a generated profile', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'porcelain-profile-'));
    onTestFinished(() => rm(parent, { recursive: true, force: true }));
    const child = spawn(
      process.execPath,
      [new URL('./playground.ts', import.meta.url).pathname],
      {
        env: {
          PATH: process.env.PATH,
          PORCELAIN_PLAYGROUND_PROFILE: 'app',
          PORCELAIN_PLAYGROUND_DIRECTORY: parent,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });
    const exited = once(child, 'close');
    onTestFinished(async () => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill('SIGTERM');
      await exited;
    });
    await vi.waitFor(() => expect(stdout, stderr).toContain('\n'), {
      timeout: 30_000,
    });
    expect(stderr).toContain('Generating the app playground base');
    const info = JSON.parse(stdout.trim()) as {
      address: string;
      tokenFile: string;
      worktreeId: string;
      profile: string;
      worktrees: { branch: string; role: string }[];
    };
    expect(info.profile).toBe('app');
    expect(info.worktrees.map(({ role }) => role)).toEqual([
      'main',
      'review',
      'agent',
    ]);
    const headers = {
      authorization: `Bearer ${await readFile(info.tokenFile, 'utf8')}`,
    };
    const inventory = inventoryResponseSchema.parse(
      await (await fetch(`${info.address}/api/inventory`, { headers })).json(),
    );
    const worktrees = inventory.projects[0]?.worktrees ?? [];
    expect(worktrees).toHaveLength(3);
    expect(
      worktrees.find((worktree) => worktree.id === info.worktreeId)?.branch,
    ).toBe('refs/heads/review');
    expect(
      await (
        await fetch(
          `${info.address}/api/worktrees/${info.worktreeId}/review-layers`,
          {
            headers,
          },
        )
      ).json(),
    ).toMatchObject({
      layers: [{ title: 'Prepare release documentation' }, {}],
    });
    child.kill('SIGTERM');
    expect((await exited)[0]).toBe(0);
    await expect(access(dirname(info.tokenFile))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await readdir(parent)).toEqual(['.cache']);
  }, 40_000);
});
