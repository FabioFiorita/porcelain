import { createHash } from 'node:crypto';
import type { GitDiffResult } from '@porcelain/git/dtos/git-diff';
import type {
  GitChange,
  GitStatusObservation,
} from '@porcelain/git/dtos/git-status';
import type { GitFactory } from '@porcelain/git/interfaces/git-factory';
import type { InspectionFactory } from '@porcelain/git/interfaces/inspection-factory';
import { expect, it } from 'vitest';
import { FileInspectionError } from '../filesystem/errors/file-inspection-error.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { WorktreeChangedError } from './errors/worktree-changed-error.ts';
import {
  MAX_EVIDENCE_CONTENT_BYTES,
  ReadWorktreeEvidence,
} from './read-worktree-evidence.ts';

const staged: GitChange = {
  scope: 'staged',
  kind: 'modified',
  oldPath: 'src/review.ts',
  newPath: 'src/review.ts',
  oldMode: '100644',
  newMode: '100644',
  supported: true,
};
const unstaged: GitChange = {
  ...staged,
  scope: 'unstaged',
};
const untracked: GitChange = { scope: 'untracked', path: 'notes.txt' };
const binary: GitChange = {
  ...staged,
  oldPath: 'assets/logo.png',
  newPath: 'assets/logo.png',
};
const unsupported: GitChange = {
  ...staged,
  oldPath: 'module',
  newPath: 'module',
  supported: false,
};
const conflict: GitChange = {
  scope: 'unmerged',
  path: 'src/conflict.ts',
  conflict: 'UU',
};

function store(): InventoryStore {
  return {
    read: () => ({
      environmentId: 'environment',
      projects: [
        {
          id: 'project',
          name: 'project',
          commonDirectory: '/fixture/.git',
          repositoryIdentity: 'repository',
          available: true,
          worktrees: [
            {
              id: 'worktree',
              path: '/fixture',
              metadataIdentity: 'identity',
              main: true,
              branch: null,
              available: true,
            },
          ],
        },
      ],
    }),
    save: () => {
      throw new Error('Evidence must not write inventory');
    },
  };
}

function status(changes: GitChange[], token = 'a'.repeat(64)) {
  return { statusToken: token, headOid: null, changes };
}

function inspection(
  observation: GitStatusObservation,
  diffs: Record<string, GitDiffResult>,
): InspectionFactory {
  return () => ({
    readStatus: async () => observation,
    readDiff: async (change) =>
      diffs[`${change.scope}:${change.newPath ?? change.oldPath}`] ?? {
        kind: 'binary',
      },
  });
}

const readableGit: GitFactory = () => ({
  listWorktrees: async () => ({
    repository: {
      commonDirectory: '/fixture/.git',
      repositoryIdentity: 'repository',
      worktrees: [
        {
          path: '/fixture',
          metadataIdentity: 'identity',
          main: true,
          branch: null,
          available: true,
        },
      ],
    },
    issues: [],
  }),
});

it('returns exact staged, unstaged, untracked and omitted evidence grouped by logical path', async () => {
  const observation = status([
    staged,
    unstaged,
    untracked,
    binary,
    unsupported,
    conflict,
  ]);
  const files = {
    read: async () => ({
      worktreeId: 'worktree',
      path: 'notes.txt',
      encoding: 'utf-8' as const,
      byteLength: 6,
      text: 'notes\n',
    }),
    list: async () => ({ worktreeId: 'worktree', path: '', entries: [] }),
  };
  const operation = new ReadWorktreeEvidence(
    store(),
    inspection(observation, {
      'staged:src/review.ts': { kind: 'text', patch: 'staged patch' },
      'unstaged:src/review.ts': { kind: 'text', patch: 'unstaged patch' },
      'staged:assets/logo.png': { kind: 'binary' },
    }),
    readableGit,
    files,
  );

  const result = await operation.execute('worktree');
  expect(result.evidence.map((entry) => entry.path)).toEqual([
    'assets/logo.png',
    'module',
    'notes.txt',
    'src/conflict.ts',
    'src/review.ts',
  ]);
  const grouped = result.evidence.find(
    (entry) => entry.path === 'src/review.ts',
  );
  expect(grouped?.comparisons.map((entry) => entry.change.scope)).toEqual([
    'staged',
    'unstaged',
  ]);
  expect(grouped?.comparisons).toEqual([
    {
      change: staged,
      content: {
        kind: 'diff',
        content: { kind: 'text', patch: 'staged patch' },
      },
    },
    {
      change: unstaged,
      content: {
        kind: 'diff',
        content: { kind: 'text', patch: 'unstaged patch' },
      },
    },
  ]);
  expect(grouped?.fingerprint).toBe(
    createHash('sha256')
      .update(
        JSON.stringify({
          path: 'src/review.ts',
          comparisons: [
            {
              change: staged,
              content: {
                kind: 'diff',
                content: { kind: 'text', patch: 'staged patch' },
              },
            },
            {
              change: unstaged,
              content: {
                kind: 'diff',
                content: { kind: 'text', patch: 'unstaged patch' },
              },
            },
          ],
        }),
      )
      .digest('hex'),
  );
  expect(
    result.evidence.find((entry) => entry.path === 'notes.txt'),
  ).toMatchObject({
    fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    comparisons: [
      {
        content: {
          kind: 'file',
          text: 'notes\n',
        },
      },
    ],
  });
  for (const path of ['assets/logo.png', 'module', 'src/conflict.ts'])
    expect(
      result.evidence.find((entry) => entry.path === path)?.fingerprint,
    ).toBeNull();
});

it('does not include a status token in the evidence fingerprint', async () => {
  const changes = [staged];
  let token = 'a'.repeat(64);
  const reader = inspection(status(changes, token), {
    'staged:src/review.ts': { kind: 'text', patch: 'same patch' },
  });
  const operation = new ReadWorktreeEvidence(store(), reader, readableGit, {
    read: async () => {
      throw new Error('not needed');
    },
    list: async () => ({ worktreeId: 'worktree', path: '', entries: [] }),
  });
  const first = await operation.execute('worktree');
  token = 'b'.repeat(64);
  const second = await new ReadWorktreeEvidence(
    store(),
    inspection(status(changes, token), {
      'staged:src/review.ts': { kind: 'text', patch: 'same patch' },
    }),
    readableGit,
    {
      read: async () => {
        throw new Error('not needed');
      },
      list: async () => ({ worktreeId: 'worktree', path: '', entries: [] }),
    },
  ).execute('worktree');
  expect(first.evidence[0]?.fingerprint).toBe(second.evidence[0]?.fingerprint);
});

it('localizes unreadable untracked files and rejects a moving worktree', async () => {
  const observation = status([untracked]);
  const operation = new ReadWorktreeEvidence(
    store(),
    inspection(observation, {}),
    readableGit,
    {
      read: async () => {
        throw new FileInspectionError('UNSUPPORTED_TEXT');
      },
      list: async () => ({ worktreeId: 'worktree', path: '', entries: [] }),
    },
  );
  await expect(operation.execute('worktree')).resolves.toMatchObject({
    evidence: [
      {
        fingerprint: null,
        comparisons: [
          { content: { kind: 'omitted', reason: 'unsupported-encoding' } },
        ],
      },
    ],
  });

  let reads = 0;
  const moving: InspectionFactory = () => ({
    readStatus: async () => {
      reads += 1;
      return status([staged], reads === 1 ? 'a'.repeat(64) : 'b'.repeat(64));
    },
    readDiff: async () => ({ kind: 'text', patch: 'moving' }),
  });
  await expect(
    new ReadWorktreeEvidence(store(), moving, readableGit, {
      read: async () => {
        throw new Error('not needed');
      },
      list: async () => ({ worktreeId: 'worktree', path: '', entries: [] }),
    }).execute('worktree'),
  ).rejects.toBeInstanceOf(WorktreeChangedError);
});

it('bounds aggregate UTF-8 evidence content while retaining affected paths', async () => {
  const firstPath = 'first.ts';
  const secondPath = 'second.ts';
  const first: GitChange = {
    scope: 'unstaged',
    kind: 'modified',
    oldPath: firstPath,
    newPath: firstPath,
    oldMode: '100644',
    newMode: '100644',
    supported: true,
  };
  const second: GitChange = {
    ...first,
    oldPath: secondPath,
    newPath: secondPath,
  };
  const unicodePatch = 'é'.repeat(Math.floor(MAX_EVIDENCE_CONTENT_BYTES * 0.3));
  const operation = new ReadWorktreeEvidence(
    store(),
    inspection(status([first, second]), {
      [`unstaged:${firstPath}`]: { kind: 'text', patch: unicodePatch },
      [`unstaged:${secondPath}`]: { kind: 'text', patch: unicodePatch },
    }),
    readableGit,
    {
      read: async () => {
        throw new Error('not needed');
      },
      list: async () => ({ worktreeId: 'worktree', path: '', entries: [] }),
    },
  );

  const result = await operation.execute('worktree');
  expect(result.evidence).toHaveLength(2);
  expect(result.evidence[0]?.comparisons[0]?.content).toMatchObject({
    kind: 'diff',
    content: { kind: 'text', patch: unicodePatch },
  });
  expect(result.evidence[1]).toMatchObject({
    path: secondPath,
    fingerprint: null,
    comparisons: [{ content: { kind: 'omitted', reason: 'size-limit' } }],
  });
  expect(Buffer.byteLength(JSON.stringify(result), 'utf8')).toBeLessThan(
    MAX_EVIDENCE_CONTENT_BYTES + 1_000_000,
  );
});
