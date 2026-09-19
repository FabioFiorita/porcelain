import type { ChildProcess } from 'node:child_process';
import { execFile, execFileSync } from 'node:child_process';
import { subscribe, unsubscribe } from 'node:diagnostics_channel';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { evidenceResponseSchema } from '@porcelain/contracts/evidence';
import { gitStatusResponseSchema } from '@porcelain/contracts/git-status';
import { projectResponseSchema } from '@porcelain/contracts/inventory';
import { describe, expect, it, onTestFinished } from 'vitest';
import { createServer } from '../server.ts';

/**
 * These are ceilings measured against this server, not targets for the rebuilt
 * one: reading evidence really does cost about one Git process per changed
 * file today. They stop that fan-out growing until the rebuild removes it, and
 * the rebuild lowers them.
 */
const token = 'git-process-budget-token-at-least-32-characters';
const headers = { authorization: `Bearer ${token}` };

const gitEnvironment = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_AUTHOR_NAME: 'Fixture',
  GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'Fixture',
  GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
};

/**
 * The channel fires inside the ChildProcess constructor, before the command is
 * recorded, so the executable is read on the next microtask.
 */
function countGitProcesses() {
  let counting = false;
  let spawned = 0;
  const listener = (message: unknown) => {
    if (!counting) return;
    const child = (message as { process: ChildProcess }).process;
    queueMicrotask(() => {
      if (basename(child.spawnfile ?? '') === 'git') spawned += 1;
    });
  };
  subscribe('child_process', listener);
  onTestFinished(() => {
    unsubscribe('child_process', listener);
  });
  return async (work: () => Promise<void>) => {
    spawned = 0;
    counting = true;
    try {
      await work();
    } finally {
      // Let the microtasks that read each command run before reporting.
      await new Promise((resolve) => setImmediate(resolve));
      counting = false;
    }
    return spawned;
  };
}

async function repository(changedFiles: number) {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'porcelain-git-budget-')),
  );
  const checkout = join(root, 'checkout');
  await mkdir(checkout);
  const git = (args: string[]) =>
    execFileSync('git', ['-C', checkout, ...args], {
      env: gitEnvironment,
      encoding: 'utf8',
    });
  execFileSync('git', ['init', '-b', 'main', checkout], {
    env: gitEnvironment,
    stdio: 'ignore',
  });
  for (let index = 0; index < changedFiles; index += 1)
    await writeFile(join(checkout, `file-${index}.ts`), 'before\n');
  git(['add', '.']);
  git(['commit', '-m', 'Initial']);
  for (let index = 0; index < changedFiles; index += 1)
    await writeFile(join(checkout, `file-${index}.ts`), `after ${index}\n`);
  return { root, checkout };
}

async function fixture(
  changedFiles: number,
  run: (
    server: Awaited<ReturnType<typeof createServer>>,
    worktreeId: string,
    measure: (work: () => Promise<void>) => Promise<number>,
  ) => Promise<void>,
) {
  const { root, checkout } = await repository(changedFiles);
  const server = await createServer({
    dataDirectory: join(root, 'state'),
    token,
  });
  try {
    const registered = projectResponseSchema.parse(
      (
        await server.inject({
          method: 'POST',
          url: '/projects',
          headers,
          payload: { path: checkout },
        })
      ).json(),
    );
    const worktreeId = registered.worktrees[0]?.id;
    if (!worktreeId) throw new Error('Fixture registration failed');
    // Subscribe after the fixture's own Git commands have run.
    await run(server, worktreeId, countGitProcesses());
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
}

describe('Git process budgets', () => {
  it('counts the Git processes an operation spawns', async () => {
    // Every budget below is an upper bound, so a counter that silently stopped
    // observing would pass all of them. Prove the instrument on a known spawn.
    const { root, checkout } = await repository(1);
    try {
      const measure = countGitProcesses();
      expect(
        await measure(async () => {
          // Asynchronous spawns are what the channel reports, and what the
          // server uses.
          await promisify(execFile)(
            'git',
            ['-C', checkout, 'rev-parse', 'HEAD'],
            {
              env: gitEnvironment,
            },
          );
        }),
      ).toBe(1);
      expect(await measure(async () => {})).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('reads evidence with a bounded number of Git processes per changed file', async () => {
    const counts: Record<number, number> = {};
    for (const changedFiles of [2, 10]) {
      await fixture(changedFiles, async (server, worktreeId, measure) => {
        counts[changedFiles] = await measure(async () => {
          const response = await server.inject({
            method: 'GET',
            url: `/worktrees/${worktreeId}/evidence`,
            headers,
          });
          expect(response.statusCode).toBe(200);
          expect(
            evidenceResponseSchema.parse(response.json()).evidence,
          ).toHaveLength(changedFiles);
        });
      });
    }
    const small = counts[2] ?? 0;
    const large = counts[10] ?? 0;
    // Measured: 36 for 2 changed files and 44 for 10, so exactly one Git
    // process per changed file over a fixed base. The fan-out is the failure
    // this guards, so the slope is asserted as well as the total.
    expect(large - small).toBeLessThanOrEqual(10);
    expect(large).toBeLessThanOrEqual(52);
  });

  it('marks a file reviewed within its budget', async () => {
    await fixture(2, async (server, worktreeId, measure) => {
      const evidence = evidenceResponseSchema.parse(
        (
          await server.inject({
            method: 'GET',
            url: `/worktrees/${worktreeId}/evidence`,
            headers,
          })
        ).json(),
      ).evidence[0];
      if (!evidence?.fingerprint) throw new Error('Expected evidence');
      const spawned = await measure(async () => {
        const response = await server.inject({
          method: 'PUT',
          url: `/worktrees/${worktreeId}/reviewed`,
          headers,
          payload: {
            path: evidence.path,
            reviewed: true,
            fingerprint: evidence.fingerprint,
          },
        });
        expect(response.statusCode).toBe(200);
      });
      // Measured 35: a database write that revalidates the fingerprint by
      // re-reading status and repository configuration first.
      expect(spawned).toBeLessThanOrEqual(42);
    });
  });

  it('reads one diff within its budget', async () => {
    await fixture(2, async (server, worktreeId, measure) => {
      const status = gitStatusResponseSchema.parse(
        (
          await server.inject({
            method: 'GET',
            url: `/worktrees/${worktreeId}/git/status`,
            headers,
          })
        ).json(),
      );
      const change = status.changes.find(
        (candidate) =>
          candidate.scope === 'staged' || candidate.scope === 'unstaged',
      );
      if (change === undefined) throw new Error('Expected an ordinary change');
      const spawned = await measure(async () => {
        const response = await server.inject({
          method: 'POST',
          url: `/worktrees/${worktreeId}/git/diff`,
          headers,
          payload: {
            expectedStatusToken: status.statusToken,
            change: {
              scope: change.scope,
              oldPath: 'oldPath' in change ? (change.oldPath ?? null) : null,
              newPath: 'newPath' in change ? (change.newPath ?? null) : null,
            },
          },
        });
        expect(response.statusCode).toBe(200);
      });
      // Measured 35: the route revalidates the status token before reading.
      expect(spawned).toBeLessThanOrEqual(42);
    });
  });

  it('reads a file within its budget', async () => {
    await fixture(2, async (server, worktreeId, measure) => {
      const spawned = await measure(async () => {
        const response = await server.inject({
          method: 'GET',
          url: `/worktrees/${worktreeId}/text?path=file-0.ts`,
          headers,
        });
        expect(response.statusCode).toBe(200);
      });
      // Measured 8.
      expect(spawned).toBeLessThanOrEqual(12);
    });
  });
});
