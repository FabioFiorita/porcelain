import type { ChildProcess } from 'node:child_process';
import { execFile, execFileSync } from 'node:child_process';
import { subscribe, unsubscribe } from 'node:diagnostics_channel';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import {
  changeDiffsResponseSchema,
  changesResponseSchema,
} from '@porcelain/contracts/changes';
import { commitFilesResponseSchema } from '@porcelain/contracts/commit-changes';
import { commitPageResponseSchema } from '@porcelain/contracts/commit-history';
import { projectResponseSchema } from '@porcelain/contracts/inventory';
import { describe, expect, it, onTestFinished } from 'vitest';
import { pairDevice, pairingReach } from '../helpers/paired-server.ts';

import { createServer } from '../server.ts';

/**
 * Ceilings measured against this server, with headroom.
 *
 * The number that matters here is not the ceiling but the slope: a change list
 * costs the same for ten changed files as for two, because it carries no
 * content. Two sizes are measured for exactly that reason — a regression that
 * reintroduced a read per file would pass a ceiling and fail the slope.
 */
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

async function repository(
  changedFiles: number,
  options: {
    awkwardNames?: boolean;
    bigPatches?: boolean;
    /** Commits made before the working changes, to give history depth. */
    commits?: number;
  } = {},
) {
  // A name Git has to quote in a patch header, and one it does not.
  const name = (index: number) =>
    options.awkwardNames
      ? `odd\t${index}\nname "${index}".ts`
      : `file-${index}.ts`;
  // Two versions that share nothing, so each patch is both of them in full
  // and the batch is larger than one response may carry.
  const body = (index: number, working: boolean) =>
    options.bigPatches
      ? `${(working ? 'y' : 'x').repeat(64)}\n`.repeat(46_000)
      : `${working ? 'after' : 'before'} ${index}\n`;
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
    await writeFile(join(checkout, name(index)), body(index, false));
  git(['add', '.']);
  git(['commit', '-m', 'Initial']);
  for (let index = 0; index < (options.commits ?? 0); index += 1)
    git(['commit', '--allow-empty', '-m', `commit ${index}`]);
  for (let index = 0; index < changedFiles; index += 1)
    await writeFile(join(checkout, name(index)), body(index, true));
  return { root, checkout };
}

async function fixture(
  changedFiles:
    | number
    | {
        files: number;
        awkwardNames?: boolean;
        bigPatches?: boolean;
        commits?: number;
      },
  run: (
    server: Awaited<ReturnType<typeof createServer>>,
    worktreeId: string,
    measure: (work: () => Promise<void>) => Promise<number>,
    headers: { authorization: string },
    /** A second server over the same checkout, with nothing cached. */
    coldServer: () => Promise<{
      server: Awaited<ReturnType<typeof createServer>>;
      worktreeId: string;
      headers: { authorization: string };
    }>,
  ) => Promise<void>,
) {
  const wanted =
    typeof changedFiles === 'number' ? { files: changedFiles } : changedFiles;
  const { root, checkout } = await repository(wanted.files, wanted);
  const server = await createServer({
    pairingReach,
    dataDirectory: join(root, 'state'),
    projectHome: join(root, 'state'),
  });
  const headers = await pairDevice(server, server.application);
  try {
    const registered = projectResponseSchema.parse(
      (
        await server.inject({
          method: 'POST',
          url: '/api/projects',
          headers,
          payload: { path: checkout },
        })
      ).json(),
    );
    const worktreeId = registered.worktrees[0]?.id;
    if (!worktreeId) throw new Error('Fixture registration failed');
    const coldServer = async () => {
      const cold = await createServer({
        pairingReach,
        dataDirectory: join(root, 'cold-state'),
        projectHome: join(root, 'cold-state'),
      });
      // A separate installation: its devices are its own.
      const coldHeaders = await pairDevice(cold, cold.application);
      const registeredCold = projectResponseSchema.parse(
        (
          await cold.inject({
            method: 'POST',
            url: '/api/projects',
            headers: coldHeaders,
            payload: { path: checkout },
          })
        ).json(),
      );
      const id = registeredCold.worktrees[0]?.id;
      if (!id) throw new Error('Cold registration failed');
      return { server: cold, worktreeId: id, headers: coldHeaders };
    };
    // Subscribe after the fixture's own Git commands have run.
    await run(server, worktreeId, countGitProcesses(), headers, coldServer);
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

  it('reads the change list at a cost that does not grow with the change', async () => {
    const counts: Record<number, number> = {};
    for (const changedFiles of [2, 10]) {
      await fixture(
        changedFiles,
        async (server, worktreeId, measure, headers) => {
          counts[changedFiles] = await measure(async () => {
            const response = await server.inject({
              method: 'GET',
              url: `/api/worktrees/${worktreeId}/changes`,
              headers,
            });
            expect(response.statusCode).toBe(200);
            expect(
              changesResponseSchema.parse(response.json()).changes,
            ).toHaveLength(changedFiles);
          });
        },
      );
    }
    const small = counts[2] ?? 0;
    const large = counts[10] ?? 0;
    // Measured 6 at both sizes: the identity guard (2), the conversion-filter
    // check (3) and one status. Working files are digested from the
    // filesystem, which costs no process and no filename can break. Flat is
    // the assertion; the ceiling is only headroom.
    expect(large).toBe(small);
    expect(large).toBeLessThanOrEqual(8);
  });

  it('reads the diffs of several files in one process per scope', async () => {
    const counts: Record<number, number> = {};
    for (const changedFiles of [2, 10]) {
      await fixture(
        changedFiles,
        async (server, worktreeId, measure, headers) => {
          const list = changesResponseSchema.parse(
            (
              await server.inject({
                method: 'GET',
                url: `/api/worktrees/${worktreeId}/changes`,
                headers,
              })
            ).json(),
          );
          const selections = list.changes.flatMap((entry) =>
            entry.comparisons.flatMap((change) =>
              change.scope === 'staged' || change.scope === 'unstaged'
                ? [
                    {
                      scope: change.scope,
                      oldPath: change.oldPath,
                      newPath: change.newPath,
                    },
                  ]
                : [],
            ),
          );
          counts[changedFiles] = await measure(async () => {
            const response = await server.inject({
              method: 'POST',
              url: `/api/worktrees/${worktreeId}/changes/diffs`,
              headers,
              payload: {
                expectedStatusToken: list.statusToken,
                expectedFiles: list.changes.map((entry) => ({
                  path: entry.path,
                  fingerprint: entry.fingerprint,
                })),
                selections,
              },
            });
            expect(response.statusCode).toBe(200);
            expect(
              changeDiffsResponseSchema.parse(response.json()).diffs,
            ).toHaveLength(selections.length);
          });
        },
      );
    }
    const small = counts[2] ?? 0;
    const large = counts[10] ?? 0;
    // Measured 7 at both sizes: the guards, one `git diff` for the whole
    // unstaged scope, and the status read twice — once to check the request
    // against and once to bind the hunks to the fingerprints returned with
    // them. Flat is the assertion; the ceiling is only headroom.
    expect(large).toBe(small);
    expect(large).toBeLessThanOrEqual(9);
  });

  /**
   * Batching is only worth anything if it holds when it is needed: a layer of
   * large patches, or of names Git has to quote in its headers. Matching the
   * header text and reading each missing file again would turn exactly those
   * layers into a process per file.
   */
  it('stays one process per scope for quoted names and for a capped batch', async () => {
    for (const shape of [
      { files: 12, awkwardNames: true },
      { files: 6, bigPatches: true },
    ]) {
      await fixture(shape, async (server, worktreeId, measure, headers) => {
        const list = changesResponseSchema.parse(
          (
            await server.inject({
              method: 'GET',
              url: `/api/worktrees/${worktreeId}/changes`,
              headers,
            })
          ).json(),
        );
        expect(list.changes).toHaveLength(shape.files);
        const selections = list.changes.flatMap((entry) =>
          entry.comparisons.flatMap((change) =>
            change.scope === 'staged' || change.scope === 'unstaged'
              ? [
                  {
                    scope: change.scope,
                    oldPath: change.oldPath,
                    newPath: change.newPath,
                  },
                ]
              : [],
          ),
        );
        const spawned = await measure(async () => {
          const response = await server.inject({
            method: 'POST',
            url: `/api/worktrees/${worktreeId}/changes/diffs`,
            headers,
            payload: {
              expectedStatusToken: list.statusToken,
              expectedFiles: list.changes.map((entry) => ({
                path: entry.path,
                fingerprint: entry.fingerprint,
              })),
              selections,
            },
          });
          expect(response.statusCode).toBe(200);
          const { diffs } = changeDiffsResponseSchema.parse(response.json());
          expect(diffs).toHaveLength(selections.length);
          // Whatever the answer is, every file gets one: its hunks, or a
          // bounded omission. None is read in a process of its own.
          for (const diff of diffs)
            expect(diff.content.kind).toBe(
              shape.bigPatches ? 'omitted' : 'text',
            );
        });
        expect(spawned, JSON.stringify(shape)).toBeLessThanOrEqual(9);
      });
    }
  });

  it('marks a file reviewed within its budget, warm and cold', async () => {
    await fixture(
      2,
      async (server, worktreeId, measure, headers, coldServer) => {
        const marked = changesResponseSchema.parse(
          (
            await server.inject({
              method: 'GET',
              url: `/api/worktrees/${worktreeId}/changes`,
              headers,
            })
          ).json(),
        ).changes[0];
        if (!marked?.fingerprint) throw new Error('Expected a markable change');
        const payload = {
          path: marked.path,
          reviewed: true,
          fingerprint: marked.fingerprint,
        };
        const spawned = await measure(async () => {
          const response = await server.inject({
            method: 'PUT',
            url: `/api/worktrees/${worktreeId}/reviewed`,
            headers,
            payload,
          });
          expect(response.statusCode).toBe(200);
        });
        // A mark is one change read: it refuses a fingerprint that no longer
        // matches, and nothing here is cached, so that costs what a list does.
        expect(spawned).toBeLessThanOrEqual(9);

        // Cold: a second server over the same checkout, which is what a mark
        // costs when it is the request's first read. Nothing is cached either
        // way, so the two are the same number.
        const cold = await coldServer();
        try {
          const coldSpawned = await measure(async () => {
            const response = await cold.server.inject({
              method: 'PUT',
              url: `/api/worktrees/${cold.worktreeId}/reviewed`,
              headers: cold.headers,
              payload,
            });
            expect(response.statusCode).toBe(200);
          });
          expect(coldSpawned).toBe(spawned);
        } finally {
          await cold.server.close();
        }
      },
    );
  });

  /**
   * A page used to cost about 62 processes — one `cat-file` for every commit
   * in it — and every later page re-walked from the tip with `--skip`.
   *
   * This counts processes, which is what it can count deterministically. The
   * traversal is bounded separately: a continuation walks from its frontier,
   * and the one ancestry question it asks is about the commit the list
   * started at, so what Git has to walk there is the commits added since,
   * not everything above a progressively deeper anchor.
   */
  it('reads a page of history in two processes at any depth', async () => {
    const counts: Record<number, { first: number; second: number }> = {};
    // Enough that both pages are full at either depth.
    for (const commits of [120, 400]) {
      await fixture(
        { files: 1, commits },
        async (server, worktreeId, measure, headers) => {
          const url = `/api/worktrees/${worktreeId}/commits?limit=50`;
          let next: { after: string[]; tip: string } | null = null;
          const first = await measure(async () => {
            const response = await server.inject({
              method: 'GET',
              url,
              headers,
            });
            expect(response.statusCode).toBe(200);
            const page = commitPageResponseSchema.parse(response.json());
            expect(page.commits).toHaveLength(50);
            next =
              page.nextAfter && page.tip
                ? { after: page.nextAfter, tip: page.tip }
                : null;
          });
          expect(next).not.toBeNull();
          const second = await measure(async () => {
            const response = await server.inject({
              method: 'GET',
              url: `${url}&after=${next?.after.join(',')}&tip=${next?.tip}`,
              headers,
            });
            expect(response.statusCode).toBe(200);
            expect(
              commitPageResponseSchema.parse(response.json()).commits,
            ).toHaveLength(50);
          });
          counts[commits] = { first, second };
        },
      );
    }
    const shallow = counts[120] ?? { first: 0, second: 0 };
    const deep = counts[400] ?? { first: 0, second: 0 };
    // One `git log` for the newest commits; one more for a continuation,
    // which asks first whether the history it started in is still the one
    // here. The guard costs nothing: it reads directories, not Git.
    expect(shallow.first).toBe(1);
    expect(shallow.second).toBe(2);
    // More than three times the history, the same cost.
    expect(deep).toEqual(shallow);
    // Making five hundred commits with real Git is the slow part, not the read.
  }, 120_000);

  /** Opening a commit reads its file list and no patches at all. */
  it('opens a commit in one process, and reads its patches separately', async () => {
    await fixture(
      { files: 12 },
      async (server, worktreeId, measure, headers) => {
        const listed = await server.inject({
          method: 'GET',
          url: `/api/worktrees/${worktreeId}/commits?limit=1`,
          headers,
        });
        const oid = commitPageResponseSchema.parse(listed.json()).commits[0]
          ?.oid;
        if (!oid) throw new Error('Missing commit');
        const base = `/api/worktrees/${worktreeId}/commits/${oid}`;
        let paths: string[][] = [];
        expect(
          await measure(async () => {
            const response = await server.inject({
              method: 'GET',
              url: `${base}/files`,
              headers,
            });
            expect(response.statusCode).toBe(200);
            paths = commitFilesResponseSchema
              .parse(response.json())
              .files.map((file) => [file.newPath ?? file.oldPath ?? '']);
          }),
        ).toBe(1);
        expect(
          await measure(async () => {
            const response = await server.inject({
              method: 'POST',
              url: `${base}/diffs`,
              headers,
              payload: { paths },
            });
            expect(response.statusCode).toBe(200);
          }),
        ).toBe(1);
      },
    );
  }, 60_000);

  it('reads a file within its budget', async () => {
    await fixture(2, async (server, worktreeId, measure, headers) => {
      const spawned = await measure(async () => {
        const response = await server.inject({
          method: 'GET',
          url: `/api/worktrees/${worktreeId}/text?path=file-0.ts`,
          headers,
        });
        expect(response.statusCode).toBe(200);
      });
      // Measured 8, unchanged: this read was never guard-bound.
      expect(spawned).toBeLessThanOrEqual(12);
    });
  });
});
