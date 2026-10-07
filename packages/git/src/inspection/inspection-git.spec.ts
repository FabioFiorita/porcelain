import { NodeServices } from '@effect/platform-node';
import { Cause, Effect, Exit } from 'effect';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readBranchDetails, readCheckoutStatus } from './inspection-git.ts';
import { gitLimits } from '../../spec/fixtures/git-limits.ts';

let checkout: string;
const git = (...args: string[]) =>
  execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
const write = (path: string, content: string | Buffer) =>
  writeFileSync(join(checkout, path), content);

function run<A, E>(work: Effect.Effect<A, E, NodeServices.NodeServices>) {
  return Effect.runPromise(work.pipe(Effect.provide(NodeServices.layer)));
}

const session = (): Effect.Effect<Parameters<typeof readCheckoutStatus>[0]> =>
  Effect.succeed({
    path: checkout,
    verify: () => Effect.void,
    confirm: () => Effect.void,
    conversionFilters: (read) => read,
  });

beforeEach(() => {
  checkout = realpathSync(
    mkdtempSync(join(tmpdir(), 'porcelain-native-inspection-')),
  );
  execFileSync('git', ['init', '-q', '-b', 'main', checkout]);
  git('config', 'user.name', 'T');
  git('config', 'user.email', 't@e');
  write('a.txt', 'base\n');
  git('add', 'a.txt');
  git('commit', '-q', '-m', 'Base', '-m', 'Body');
});
afterEach(() => rmSync(checkout, { recursive: true, force: true }));

describe('native checkout inspection', () => {
  it('reads staged and unstaged versions separately, lists untracked paths and reports an in-progress merge', async () => {
    const head = git('rev-parse', 'HEAD');
    write('a.txt', 'staged\n');
    git('add', 'a.txt');
    write('a.txt', 'unstaged\n');
    write('new.txt', 'untracked\n');
    write('.git/MERGE_HEAD', `${head}\n`);
    const status = await run(
      Effect.flatMap(session(), (opened) =>
        readCheckoutStatus(opened, gitLimits),
      ),
    );
    expect(status).toMatchObject({
      headOid: head,
      branch: { name: 'main', upstream: null, ahead: 0, behind: 0 },
      inProgress: 'merge',
      mergeHeadOid: head,
    });
    expect(status.changes.map((change) => change.scope)).toEqual([
      'staged',
      'unstaged',
      'untracked',
    ]);
    expect(status.changes.at(-1)).toEqual({
      scope: 'untracked',
      path: 'new.txt',
    });
    expect(status.statusToken).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('reads head commit details without inventing remote tracking information', async () => {
    const head = git('rev-parse', 'HEAD');
    const details = await run(
      Effect.flatMap(session(), (opened) =>
        readBranchDetails(opened, 'main', head, gitLimits),
      ),
    );
    expect(details).toEqual({
      remoteName: null,
      sourceRef: null,
      upstreamOid: null,
      stashes: [],
      discarded: [],
      headCommit: { subject: 'Base', body: 'Body' },
    });
  });

  it('honors interruption during checkout verification before returning a status', async () => {
    const exit = await run(
      Effect.exit(
        Effect.gen(function* () {
          const opened = yield* session();
          return yield* readCheckoutStatus(
            { ...opened, verify: () => Effect.interrupt },
            gitLimits,
          );
        }),
      ),
    );
    expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(
      true,
    );
  });

  it.each([
    {
      kind: 'byte',
      limits: {
        ...gitLimits,
        inspection: { ...gitLimits.inspection, statusBytes: 1 },
      },
    },
    {
      kind: 'change-count',
      limits: {
        ...gitLimits,
        inspection: { ...gitLimits.inspection, maxChanges: 0 },
      },
    },
  ])(
    'fails in the typed channel when status exceeds its $kind limit',
    async ({ limits }) => {
      write('new.txt', 'new\n');
      const failure = await run(
        Effect.flip(
          Effect.flatMap(session(), (opened) =>
            readCheckoutStatus(opened, limits),
          ),
        ),
      );
      expect(failure).toMatchObject({ name: 'InspectionLimitError' });
    },
  );

  it('refuses a filename whose bytes are not UTF-8 in the typed channel', async () => {
    execFileSync(
      'git',
      ['-C', checkout, 'update-index', '-z', '--index-info'],
      {
        input: Buffer.concat([
          Buffer.from(`100644 ${git('rev-parse', 'HEAD:a.txt')}\t`),
          Buffer.from([0xff, 0]),
        ]),
      },
    );
    const failure = await run(
      Effect.flip(
        Effect.flatMap(session(), (opened) =>
          readCheckoutStatus(opened, gitLimits),
        ),
      ),
    );
    expect(failure).toMatchObject({ name: 'UnsupportedPathEncodingError' });
  });
});
