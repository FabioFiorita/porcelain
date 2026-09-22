import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type {
  ActionInput,
  Expectation,
  Receipt,
} from '@porcelain/contracts/git-actions';
import { runGitActionRequestSchema } from '@porcelain/contracts/git-actions';
import { createIsolatedGit } from '@porcelain/git/fixtures/isolated-git';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDatabase } from '../../db/connection.ts';
import { GitActionRepository } from '../../repositories/git-action-repository.ts';
import { pairDevice, pairingReach } from '../helpers/paired-server.ts';
import { createServer } from '../server.ts';

describe('direct Git actions HTTP', () => {
  const execute = promisify(execFile);
  let root: string;
  let checkout: string;
  let dataDirectory: string;
  let server: Awaited<ReturnType<typeof createServer>>;
  let prefix: string;
  let projectId: string;
  let worktreeId: string;
  let headers: { authorization: string };

  async function git(...args: string[]) {
    return (await execute('git', ['-C', checkout, ...args])).stdout.trimEnd();
  }
  async function snapshot(paths: string[] | 'all' = []): Promise<Expectation> {
    const statusResponse = await server.inject({
      url: `/api/worktrees/${worktreeId}/git/status`,
      headers,
    });
    expect(statusResponse.statusCode, statusResponse.body).toBe(200);
    const status = statusResponse.json<{
      headOid: string | null;
      inProgress: 'merge' | 'rebase' | null;
      mergeHeadOid: string | null;
      branch?: {
        name: string | null;
        upstreamOid?: string | null;
      };
    }>();
    const changes = (
      await server.inject({
        url: `/api/worktrees/${worktreeId}/changes`,
        headers,
      })
    ).json<{
      changes: { path: string; fingerprint: string | null }[];
    }>().changes;
    return {
      headOid: status.headOid,
      branch: status.branch?.name ?? null,
      inProgress: status.inProgress,
      mergeHeadOid: status.mergeHeadOid,
      upstreamOid: status.branch?.upstreamOid ?? null,
      files: changes
        .filter((change) => paths === 'all' || paths.includes(change.path))
        .map((change) => {
          if (!change.fingerprint)
            throw new Error(`Missing fingerprint for ${change.path}`);
          return { path: change.path, fingerprint: change.fingerprint };
        }),
    };
  }
  async function run(
    input: ActionInput,
    expected: Expectation,
    requestId = randomUUID(),
  ) {
    runGitActionRequestSchema.parse({ requestId, input, expected });
    const response = await server.inject({
      method: 'POST',
      url: `${prefix}/actions`,
      headers,
      payload: { requestId, input, expected },
    });
    expect([200, 202, 409, 503], response.body).toContain(response.statusCode);
    return { requestId, response };
  }
  async function outcome(requestId: string): Promise<Receipt> {
    await expect
      .poll(
        async () =>
          (
            await server.inject({
              url: `/api/git-action-requests/${requestId}`,
              headers,
            })
          ).json<Receipt>().state,
        { timeout: 10_000 },
      )
      .not.toBe('running');
    return (
      await server.inject({
        url: `/api/git-action-requests/${requestId}`,
        headers,
      })
    ).json<Receipt>();
  }

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'porcelain-direct-action-'));
    vi.stubEnv('HOME', root);
    vi.stubEnv('XDG_CONFIG_HOME', root);
    vi.stubEnv('PATH', `${await createIsolatedGit(root)}:${process.env.PATH}`);
    checkout = join(root, 'checkout');
    dataDirectory = join(root, 'data');
    await mkdir(checkout);
    await git('init', '-b', 'main');
    await git('config', 'user.name', 'Fixture');
    await git('config', 'user.email', 'fixture@example.invalid');
    await writeFile(join(checkout, 'file'), 'base\n');
    await git('add', 'file');
    await git('commit', '-m', 'base');
    server = await createServer({
      pairingReach,
      dataDirectory,
      projectHome: dataDirectory,
    });
    headers = await pairDevice(server, server.application);
    const project = (
      await server.inject({
        method: 'POST',
        url: '/api/projects',
        headers,
        payload: { path: checkout },
      })
    ).json<{ id: string; worktrees: { id: string }[] }>();
    worktreeId = project.worktrees[0]?.id ?? '';
    projectId = project.id;
    prefix = `/api/projects/${projectId}/worktrees/${worktreeId}/git`;
  });

  afterEach(async () => {
    await server.close();
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  it('commits selected files once and serves the durable receipt after restart', async () => {
    await writeFile(join(checkout, 'file'), 'selected\n');
    const expected = await snapshot(['file']);
    const requestId = randomUUID();
    const first = await run(
      { action: 'commit', message: 'selected', paths: ['file'] },
      expected,
      requestId,
    );
    expect(first.response.statusCode).toBe(202);
    expect(await outcome(requestId)).toMatchObject({
      state: 'succeeded',
      action: 'commit',
    });
    const replay = await run(
      { action: 'commit', message: 'selected', paths: ['file'] },
      expected,
      requestId,
    );
    expect(replay.response.statusCode).toBe(200);
    expect(await git('rev-list', '--count', 'HEAD')).toBe('2');

    await server.close();
    server = await createServer({
      pairingReach,
      dataDirectory,
      projectHome: dataDirectory,
    });
    headers = await pairDevice(server, server.application);
    expect(await outcome(requestId)).toMatchObject({ state: 'succeeded' });
    expect(await git('rev-list', '--count', 'HEAD')).toBe('2');
  });

  it('refuses only when a selected file changed since it was displayed', async () => {
    await writeFile(join(checkout, 'file'), 'selected\n');
    await writeFile(join(checkout, 'other'), 'unselected\n');
    const expected = await snapshot(['file']);
    await writeFile(join(checkout, 'other'), 'unselected moved\n');
    const accepted = await run(
      { action: 'commit', message: 'selected', paths: ['file'] },
      expected,
    );
    expect(await outcome(accepted.requestId)).toMatchObject({
      state: 'succeeded',
    });

    await writeFile(join(checkout, 'file'), 'reviewed\n');
    const stale = await snapshot(['file']);
    await writeFile(join(checkout, 'file'), 'agent edit\n');
    const refused = await run(
      { action: 'commit', message: 'must refuse', paths: ['file'] },
      stale,
    );
    expect(await outcome(refused.requestId)).toMatchObject({
      state: 'rejected',
      reason: 'CHANGED_SINCE_LOOKED',
    });
    expect(await git('rev-list', '--count', 'HEAD')).toBe('2');
  });

  it('names the configuration key that refuses an action', async () => {
    await git('config', 'remote.backup.mirror', 'true');
    await writeFile(join(checkout, 'file'), 'selected\n');
    const refused = await run(
      { action: 'commit', message: 'refused', paths: ['file'] },
      await snapshot(['file']),
    );
    expect(await outcome(refused.requestId)).toMatchObject({
      state: 'rejected',
      reason: 'UNSUPPORTED_CONFIGURATION',
      message: expect.stringMatching(
        /^Git config sets `remote\.backup\.mirror`, .* Run this action from a terminal instead\.$/,
      ),
    });
    expect(await git('rev-list', '--count', 'HEAD')).toBe('1');
  });

  it('commits a selected file without reading an unrelated oversized change', async () => {
    await writeFile(join(checkout, 'file'), 'selected\n');
    const expected = await snapshot(['file']);
    await writeFile(
      join(checkout, 'large.bin'),
      Buffer.alloc(33 * 1024 * 1024, 1),
    );
    const accepted = await run(
      { action: 'commit', message: 'selected only', paths: ['file'] },
      expected,
    );
    expect(await outcome(accepted.requestId)).toMatchObject({
      state: 'succeeded',
    });
    expect(await git('status', '--short')).toContain('?? large.bin');
  });

  it('fetches without reading oversized working content', async () => {
    const remote = join(root, 'remote.git');
    await git('init', '--bare', remote);
    await git('remote', 'add', 'origin', remote);
    await git('push', '-u', 'origin', 'main');
    const expected = await snapshot();
    delete expected.files;
    await writeFile(
      join(checkout, 'large.bin'),
      Buffer.alloc(33 * 1024 * 1024, 1),
    );
    const fetched = await run(
      {
        action: 'fetch',
        remoteName: 'origin',
        sourceRef: 'refs/heads/main',
      },
      expected,
    );
    expect(await outcome(fetched.requestId)).toMatchObject({
      state: expect.stringMatching(/^(succeeded|no-change)$/),
    });
  });

  it('discards one file recoverably and restores it through the saved stash', async () => {
    await writeFile(join(checkout, 'other'), 'other base\n');
    await git('add', 'other');
    await git('commit', '-m', 'other base');
    await writeFile(join(checkout, 'other'), 'unrelated change\n');
    await writeFile(join(checkout, 'file'), 'discarded\n');
    const discarded = await run(
      { action: 'discard', path: 'file' },
      await snapshot(['file']),
    );
    const receipt = await outcome(discarded.requestId);
    expect(receipt).toMatchObject({
      state: 'succeeded',
      result: { stashRetained: true },
    });
    expect(await readFile(join(checkout, 'file'), 'utf8')).toBe('base\n');
    const stashOid = receipt.result?.restoreStashOid;
    if (!stashOid) throw new Error('Missing recovery stash');
    const restored = await run(
      {
        action: 'stash-apply',
        stashOid,
        restoreIndex: receipt.result?.restoreIndex ?? false,
      },
      await snapshot(['other']),
    );
    const restoredReceipt = await outcome(restored.requestId);
    expect(restoredReceipt, JSON.stringify(restoredReceipt)).toMatchObject({
      state: 'succeeded',
    });
    expect(await readFile(join(checkout, 'file'), 'utf8')).toBe('discarded\n');
    expect(await readFile(join(checkout, 'other'), 'utf8')).toBe(
      'unrelated change\n',
    );
  });

  it('round-trips a whole-file discard with staged and unstaged content', async () => {
    await writeFile(join(checkout, 'file'), 'staged\n');
    await git('add', 'file');
    await writeFile(join(checkout, 'file'), 'unstaged\n');
    const discarded = await run(
      { action: 'discard', path: 'file' },
      await snapshot(['file']),
    );
    const receipt = await outcome(discarded.requestId);
    expect(receipt).toMatchObject({
      state: 'succeeded',
      result: { restoreIndex: true },
    });
    const stashOid = receipt.result?.restoreStashOid;
    if (!stashOid) throw new Error('Missing recovery stash');
    const restored = await run(
      { action: 'stash-apply', stashOid, restoreIndex: true },
      await snapshot(),
    );
    expect(await outcome(restored.requestId)).toMatchObject({
      state: 'succeeded',
    });
    expect(await git('show', ':file')).toBe('staged');
    expect(await readFile(join(checkout, 'file'), 'utf8')).toBe('unstaged\n');
  });

  it('round-trips both sides of a renamed file discard', async () => {
    await git('mv', 'file', 'renamed');
    await writeFile(join(checkout, 'renamed'), 'renamed content\n');
    const discarded = await run(
      { action: 'discard', path: 'renamed' },
      await snapshot(['renamed']),
    );
    const receipt = await outcome(discarded.requestId);
    expect(receipt, JSON.stringify(receipt)).toMatchObject({
      state: 'succeeded',
    });
    expect(await readFile(join(checkout, 'file'), 'utf8')).toBe('base\n');
    const stashOid = receipt.result?.restoreStashOid;
    if (!stashOid) throw new Error('Missing recovery stash');
    const restored = await run(
      { action: 'stash-apply', stashOid, restoreIndex: true },
      await snapshot(),
    );
    expect(await outcome(restored.requestId)).toMatchObject({
      state: 'succeeded',
    });
    expect(await readFile(join(checkout, 'renamed'), 'utf8')).toBe(
      'renamed content\n',
    );
    expect(await git('status', '--short')).toContain('file -> renamed');
  });

  it('discards one hunk while retaining a recovery stash for the whole file', async () => {
    await writeFile(join(checkout, 'file'), 'one\ntwo\nthree\n');
    await git('add', 'file');
    await git('commit', '-m', 'three lines');
    await writeFile(join(checkout, 'file'), 'ONE\ntwo\nTHREE\n');
    const discarded = await run(
      {
        action: 'discard',
        path: 'file',
        hunk: { scope: 'unstaged', startLine: 1, endLine: 1 },
      },
      await snapshot(['file']),
    );
    const receipt = await outcome(discarded.requestId);
    expect(receipt).toMatchObject({
      state: 'succeeded',
      result: { restoreStashOid: expect.any(String) },
    });
    expect(await readFile(join(checkout, 'file'), 'utf8')).toBe(
      'one\ntwo\nTHREE\n',
    );
    expect(
      await git('cat-file', '-t', receipt.result?.restoreStashOid ?? ''),
    ).toBe('blob');
    const restored = await run(
      {
        action: 'stash-apply',
        stashOid: receipt.result?.restoreStashOid ?? '',
        restoreIndex: false,
      },
      await snapshot(['file']),
    );
    const restoredHunk = await outcome(restored.requestId);
    expect(restoredHunk, JSON.stringify(restoredHunk)).toMatchObject({
      state: 'succeeded',
      result: { stashRetained: false },
    });
    expect(await readFile(join(checkout, 'file'), 'utf8')).toBe(
      'ONE\ntwo\nTHREE\n',
    );
  });

  it('refuses partial hunk ranges and discards an exact staged hunk', async () => {
    await writeFile(join(checkout, 'file'), 'one\ntwo\nthree\n');
    await git('add', 'file');
    await git('commit', '-m', 'three lines');
    await writeFile(join(checkout, 'file'), 'ONE\nTWO\nthree\n');
    const partial = await run(
      {
        action: 'discard',
        path: 'file',
        hunk: { scope: 'unstaged', startLine: 1, endLine: 1 },
      },
      await snapshot(['file']),
    );
    expect(await outcome(partial.requestId)).toMatchObject({
      state: 'rejected',
      reason: 'UNSUPPORTED_CONFIGURATION',
      message:
        'The selected lines cover only part of a change. Select the whole change to discard it.',
    });
    expect(await readFile(join(checkout, 'file'), 'utf8')).toBe(
      'ONE\nTWO\nthree\n',
    );

    await git('add', 'file');
    const staged = await run(
      {
        action: 'discard',
        path: 'file',
        hunk: { scope: 'staged', startLine: 1, endLine: 2 },
      },
      await snapshot(['file']),
    );
    const stagedReceipt = await outcome(staged.requestId);
    expect(stagedReceipt).toMatchObject({
      state: 'succeeded',
      result: { restoreStashOid: expect.any(String) },
    });
    expect(await git('diff', '--cached', '--name-only')).toBe('');
    expect(await readFile(join(checkout, 'file'), 'utf8')).toBe(
      'one\ntwo\nthree\n',
    );
    const restored = await run(
      {
        action: 'stash-apply',
        stashOid: stagedReceipt.result?.restoreStashOid ?? '',
        restoreIndex: true,
      },
      await snapshot(),
    );
    expect(await outcome(restored.requestId)).toMatchObject({
      state: 'succeeded',
    });
    expect(await git('show', ':file')).toBe('ONE\nTWO\nthree');
    expect(await git('diff', '--name-only')).toBe('');
    expect(await git('diff', '--cached', '--name-only')).toBe('file');
  });

  it('amends without adding a commit and creates then switches branches', async () => {
    await writeFile(join(checkout, 'file'), 'amended\n');
    const amended = await run(
      { action: 'amend', message: 'amended base', paths: ['file'] },
      await snapshot(['file']),
    );
    expect(await outcome(amended.requestId)).toMatchObject({
      state: 'succeeded',
    });
    expect(await git('rev-list', '--count', 'HEAD')).toBe('1');
    expect(await git('show', '-s', '--format=%s', 'HEAD')).toBe('amended base');

    const created = await run(
      { action: 'create-branch', branch: 'topic', switchTo: false },
      await snapshot(),
    );
    expect(await outcome(created.requestId)).toMatchObject({
      state: 'succeeded',
      result: { branch: 'topic' },
    });
    const branches = await server.inject({
      url: `${prefix}/branches`,
      headers,
    });
    expect(branches.json()).toMatchObject({
      current: 'main',
      branches: expect.arrayContaining([
        expect.objectContaining({ name: 'topic' }),
      ]),
    });
    const switched = await run(
      { action: 'switch-branch', branch: 'topic' },
      await snapshot(),
    );
    expect(await outcome(switched.requestId)).toMatchObject({
      state: 'succeeded',
    });
    expect(await git('branch', '--show-current')).toBe('topic');
  });

  it('amends only the HEAD message while preserving the real staged index', async () => {
    await writeFile(join(checkout, 'file'), 'staged for later\n');
    await git('add', 'file');
    const indexPath = await git(
      'rev-parse',
      '--path-format=absolute',
      '--git-path',
      'index',
    );
    const beforeIndex = await readFile(indexPath);
    const beforeTree = await git('show', '-s', '--format=%T', 'HEAD');
    const amended = await run(
      { action: 'amend', message: 'message only\n\nkept body', paths: [] },
      await snapshot(),
    );
    expect(await outcome(amended.requestId)).toMatchObject({
      state: 'succeeded',
    });
    expect(await git('show', '-s', '--format=%s%n%b', 'HEAD')).toBe(
      'message only\nkept body',
    );
    expect(await git('show', '-s', '--format=%T', 'HEAD')).toBe(beforeTree);
    expect(await readFile(indexPath)).toEqual(beforeIndex);
    expect(await git('diff', '--cached', '--name-only')).toBe('file');
  });

  it('finishes a merge from the selected resolution and exposes merge state', async () => {
    await git('switch', '-c', 'other');
    await writeFile(join(checkout, 'file'), 'other\n');
    await git('commit', '-am', 'other');
    await git('switch', 'main');
    await writeFile(join(checkout, 'file'), 'main\n');
    await git('commit', '-am', 'main');
    await expect(git('merge', 'other')).rejects.toThrow();
    await writeFile(join(checkout, 'file'), 'resolved\n');

    const changes = await server.inject({
      url: `/api/worktrees/${worktreeId}/changes`,
      headers,
    });
    expect(changes.json()).toMatchObject({
      inProgress: 'merge',
      changes: [
        {
          path: 'file',
          fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
          comparisons: [{ scope: 'unmerged', conflict: 'UU' }],
        },
      ],
    });
    const status = await server.inject({
      url: `/api/worktrees/${worktreeId}/git/status`,
      headers,
    });
    expect(status.json()).toMatchObject({
      inProgress: 'merge',
      headCommit: { subject: 'main' },
    });

    const merged = await run(
      { action: 'commit', message: 'merge other', paths: ['file'] },
      await snapshot('all'),
    );
    expect(await outcome(merged.requestId)).toMatchObject({
      state: 'succeeded',
    });
    expect(await git('show', ':file')).toBe('resolved');
    expect(await git('show', '-s', '--format=%P', 'HEAD')).toMatch(
      /^[a-f0-9]{40} [a-f0-9]{40}$/,
    );
    expect(await git('status', '--porcelain')).toBe('');
  });

  it('creates an empty-tree merge commit after choosing the current side', async () => {
    await git('switch', '-c', 'other');
    await writeFile(join(checkout, 'file'), 'other\n');
    await git('commit', '-am', 'other');
    await git('switch', 'main');
    await writeFile(join(checkout, 'anchor'), 'main\n');
    await git('add', 'anchor');
    await git('commit', '-m', 'main');
    await git('merge', '--no-commit', '--no-ff', 'other');
    await git('restore', '--source=HEAD', '--staged', '--worktree', 'file');
    expect((await snapshot('all')).files).toEqual([]);

    const merged = await run(
      { action: 'commit', message: 'keep ours', paths: [] },
      await snapshot('all'),
    );
    expect(await outcome(merged.requestId)).toMatchObject({
      state: 'succeeded',
    });
    expect(await git('show', '-s', '--format=%P', 'HEAD')).toMatch(
      /^[a-f0-9]{40} [a-f0-9]{40}$/,
    );
  });

  it('rejects a different merge parent even when the displayed tree is identical', async () => {
    await git('switch', '-c', 'side-one');
    await git('commit', '--allow-empty', '-m', 'side one');
    const sideOne = await git('rev-parse', 'HEAD');
    await git('switch', 'main');
    await git('switch', '-c', 'side-two');
    await git('commit', '--allow-empty', '-m', 'side two');
    const sideTwo = await git('rev-parse', 'HEAD');
    await git('switch', 'main');
    await writeFile(join(checkout, 'anchor'), 'main\n');
    await git('add', 'anchor');
    await git('commit', '-m', 'diverge main');

    await git('merge', '--no-commit', '--no-ff', 'side-one');
    const expected = await snapshot('all');
    expect(expected).toMatchObject({
      inProgress: 'merge',
      mergeHeadOid: sideOne,
      files: [],
    });
    await git('merge', '--abort');
    await git('merge', '--no-commit', '--no-ff', 'side-two');
    const indexPath = await git(
      'rev-parse',
      '--path-format=absolute',
      '--git-path',
      'index',
    );
    const beforeIndex = await readFile(indexPath);
    const beforeHead = await git('rev-parse', 'HEAD');
    expect(await git('rev-parse', 'MERGE_HEAD')).toBe(sideTwo);

    const attempted = await run(
      { action: 'commit', message: 'wrong parent', paths: [] },
      expected,
    );
    expect(await outcome(attempted.requestId)).toMatchObject({
      state: 'rejected',
      reason: 'CHANGED_SINCE_LOOKED',
    });
    expect(await readFile(indexPath)).toEqual(beforeIndex);
    expect(await git('rev-parse', 'HEAD')).toBe(beforeHead);
    expect(await git('rev-parse', 'MERGE_HEAD')).toBe(sideTwo);
  });

  it('rejects an unseen staged merge path before mutating merge state', async () => {
    await writeFile(join(checkout, 'other-file'), 'base\n');
    await git('add', 'other-file');
    await git('commit', '-m', 'add other file');
    await git('switch', '-c', 'other');
    await writeFile(join(checkout, 'file'), 'other\n');
    await git('commit', '-am', 'other');
    await git('switch', 'main');
    await writeFile(join(checkout, 'file'), 'main\n');
    await git('commit', '-am', 'main');
    await expect(git('merge', 'other')).rejects.toThrow();
    await writeFile(join(checkout, 'file'), 'resolved\n');
    const expected = await snapshot('all');

    await writeFile(join(checkout, 'other-file'), 'staged later\n');
    await git('add', 'other-file');
    const indexPath = await git(
      'rev-parse',
      '--path-format=absolute',
      '--git-path',
      'index',
    );
    const beforeIndex = await readFile(indexPath);
    const beforeHead = await git('rev-parse', 'HEAD');
    const beforeMergeHead = await git('rev-parse', 'MERGE_HEAD');
    const attempted = await run(
      { action: 'commit', message: 'must reject', paths: ['file'] },
      expected,
    );
    expect(await outcome(attempted.requestId)).toMatchObject({
      state: 'rejected',
      reason: 'CHANGED_SINCE_LOOKED',
    });
    expect(await readFile(indexPath)).toEqual(beforeIndex);
    expect(await git('rev-parse', 'HEAD')).toBe(beforeHead);
    expect(await git('rev-parse', 'MERGE_HEAD')).toBe(beforeMergeHead);
  });

  it('preserves the real merge index when an unselected conflict blocks commit', async () => {
    await writeFile(join(checkout, 'second'), 'base\n');
    await git('add', 'second');
    await git('commit', '-m', 'add second');
    await git('switch', '-c', 'other');
    await writeFile(join(checkout, 'file'), 'other\n');
    await writeFile(join(checkout, 'second'), 'other\n');
    await git('commit', '-am', 'other');
    await git('switch', 'main');
    await writeFile(join(checkout, 'file'), 'main\n');
    await writeFile(join(checkout, 'second'), 'main\n');
    await git('commit', '-am', 'main');
    await expect(git('merge', 'other')).rejects.toThrow();
    await writeFile(join(checkout, 'file'), 'resolved\n');
    const expected = await snapshot('all');
    const indexPath = await git(
      'rev-parse',
      '--path-format=absolute',
      '--git-path',
      'index',
    );
    const beforeIndex = await readFile(indexPath);
    const beforeHead = await git('rev-parse', 'HEAD');
    const beforeMergeHead = await git('rev-parse', 'MERGE_HEAD');
    const attempted = await run(
      { action: 'commit', message: 'still unresolved', paths: ['file'] },
      expected,
    );
    expect(await outcome(attempted.requestId)).toMatchObject({
      state: 'rejected',
      reason: 'GIT_REJECTED',
    });
    expect(await readFile(indexPath)).toEqual(beforeIndex);
    expect(await git('rev-parse', 'HEAD')).toBe(beforeHead);
    expect(await git('rev-parse', 'MERGE_HEAD')).toBe(beforeMergeHead);
  });

  it('preserves the real merge index when a commit hook rejects', async () => {
    await git('switch', '-c', 'other');
    await writeFile(join(checkout, 'file'), 'other\n');
    await git('commit', '-am', 'other');
    await git('switch', 'main');
    await writeFile(join(checkout, 'file'), 'main\n');
    await git('commit', '-am', 'main');
    await expect(git('merge', 'other')).rejects.toThrow();
    await writeFile(join(checkout, 'file'), 'resolved\n');
    const expected = await snapshot('all');
    await writeFile(
      join(checkout, '.git/hooks/pre-commit'),
      '#!/bin/sh\nexit 1\n',
      {
        mode: 0o755,
      },
    );
    const indexPath = await git(
      'rev-parse',
      '--path-format=absolute',
      '--git-path',
      'index',
    );
    const beforeIndex = await readFile(indexPath);
    const beforeMergeHead = await git('rev-parse', 'MERGE_HEAD');
    const attempted = await run(
      { action: 'commit', message: 'hook rejects', paths: ['file'] },
      expected,
    );
    expect(await outcome(attempted.requestId)).toMatchObject({
      state: 'rejected',
      reason: 'GIT_REJECTED',
    });
    expect(await readFile(indexPath)).toEqual(beforeIndex);
    expect(await git('rev-parse', 'MERGE_HEAD')).toBe(beforeMergeHead);
  });

  it('rejects an action after checkout moves to another branch at the same commit', async () => {
    await git('branch', 'topic');
    await writeFile(join(checkout, 'file'), 'reviewed on main\n');
    const expected = await snapshot(['file']);
    await git('switch', 'topic');
    const attempted = await run(
      { action: 'commit', message: 'wrong branch', paths: ['file'] },
      expected,
    );
    expect(await outcome(attempted.requestId)).toMatchObject({
      state: 'rejected',
      reason: 'CHANGED_SINCE_LOOKED',
    });
    expect(await git('rev-list', '--count', 'HEAD')).toBe('1');
  });

  it('stashes the exact displayed change list and rejects a later added file', async () => {
    await writeFile(join(checkout, 'file'), 'changed\n');
    const expected = await snapshot(['file']);
    await writeFile(join(checkout, 'later'), 'later\n');
    const refused = await run(
      {
        action: 'stash-create',
        message: 'displayed changes',
        includeUntracked: true,
      },
      expected,
    );
    expect(await outcome(refused.requestId)).toMatchObject({
      state: 'rejected',
      reason: 'CHANGED_SINCE_LOOKED',
    });
  });

  it('shows an interrupted restart with current Git state until dismissed', async () => {
    await writeFile(join(checkout, 'file'), 'still changed\n');
    await server.close();
    const database = openDatabase(dataDirectory);
    const requestId = randomUUID();
    try {
      new GitActionRepository(database.db).acceptDirect(
        { projectId, worktreeId },
        requestId,
        { action: 'switch-branch', branch: 'topic' },
        {
          headOid: await git('rev-parse', 'HEAD'),
          branch: 'main',
          inProgress: null,
          mergeHeadOid: null,
        },
        'interrupted-fixture',
      );
    } finally {
      database.close();
    }
    server = await createServer({
      pairingReach,
      dataDirectory,
      projectHome: dataDirectory,
    });
    headers = await pairDevice(server, server.application);
    const before = await server.inject({
      url: `/api/worktrees/${worktreeId}/changes`,
      headers,
    });
    expect(before.json()).toMatchObject({
      interrupted: {
        requestId,
        action: 'switch-branch',
        gitState: expect.stringContaining('1 changed path remains'),
      },
    });
    const dismissed = await server.inject({
      method: 'DELETE',
      url: `${prefix}/interrupted/${requestId}`,
      headers,
    });
    expect(dismissed.statusCode, dismissed.body).toBe(200);
    const after = await server.inject({
      url: `/api/worktrees/${worktreeId}/changes`,
      headers,
    });
    expect(after.json()).not.toHaveProperty('interrupted');
    expect(await outcome(requestId)).toMatchObject({ state: 'interrupted' });
  });
});
