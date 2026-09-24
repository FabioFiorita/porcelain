import { describe, expect, it } from 'vitest';
import type {
  GitActionExpectation,
  GitActionIntent,
  GitActionProblem,
} from '@porcelain/git-actions/models';
import { gitActionProblem } from './git-action-problem.ts';

const fingerprint = 'a'.repeat(64);
const mergeHeadOid = 'b'.repeat(40);
const stashOid = 'd'.repeat(40);
const merging = { inProgress: 'merge' as const, mergeHeadOid };
const remote = { remoteName: 'origin', sourceRef: 'refs/heads/main' };
const files = (...paths: string[]) =>
  paths.map((path) => ({ path, fingerprint }));
const branch: GitActionIntent = {
  action: 'create-branch',
  branch: 'feature',
  switchTo: false,
};
const discard: GitActionIntent = { action: 'discard', path: 'README.md' };

type Row = {
  name: string;
  intent: GitActionIntent;
  expected: GitActionExpectation;
  problem: GitActionProblem | undefined;
};

describe('gitActionProblem', () => {
  it.each<Row>([
    {
      name: 'a discarded hunk that ends before it starts',
      intent: {
        action: 'discard',
        path: 'README.md',
        hunk: { scope: 'unstaged', startLine: 3, endLine: 2 },
      },
      expected: { files: files('README.md') },
      problem: { kind: 'hunk-range' },
    },
    {
      name: 'a path expected twice, even with the same fingerprint',
      intent: branch,
      expected: { files: files('README.md', 'README.md') },
      problem: { kind: 'duplicate-expected-file' },
    },
    {
      name: 'a merge in progress without its merge head',
      intent: branch,
      expected: { inProgress: 'merge' },
      problem: { kind: 'merge-expectation' },
    },
    {
      name: 'a merge head without a merge in progress',
      intent: branch,
      expected: { mergeHeadOid },
      problem: { kind: 'merge-expectation' },
    },
    {
      name: 'a merge head during a rebase',
      intent: branch,
      expected: { inProgress: 'rebase', mergeHeadOid },
      problem: { kind: 'merge-expectation' },
    },
    {
      name: 'a commit that selects no path',
      intent: { action: 'commit', message: 'Fix', paths: [] },
      expected: { files: [] },
      problem: { kind: 'empty-commit-selection' },
    },
    {
      name: 'a commit that states no expected files',
      intent: { action: 'commit', message: 'Fix', paths: ['README.md'] },
      expected: {},
      problem: { kind: 'missing-expected-files' },
    },
    {
      name: 'an amend that states no expected files',
      intent: { action: 'amend', message: 'Reword', paths: [] },
      expected: {},
      problem: { kind: 'missing-expected-files' },
    },
    {
      name: 'a commit that expects a file it does not select',
      intent: { action: 'commit', message: 'Fix', paths: ['a.md'] },
      expected: { files: files('a.md', 'b.md') },
      problem: { kind: 'expected-files-mismatch' },
    },
    {
      name: 'an amend that selects a path it does not expect',
      intent: { action: 'amend', message: 'Fix', paths: ['a.md', 'b.md'] },
      expected: { files: files('a.md') },
      problem: { kind: 'expected-files-mismatch' },
    },
    {
      name: 'a merge commit that selects a path it does not expect',
      intent: { action: 'commit', message: 'Merge', paths: ['c.md'] },
      expected: { ...merging, files: files('a.md') },
      problem: { kind: 'expected-files-mismatch' },
    },
    {
      name: 'a discard that expects no file',
      intent: discard,
      expected: { files: [] },
      problem: { kind: 'discard-expectation' },
    },
    {
      name: 'a discard that expects another path',
      intent: discard,
      expected: { files: files('GUIDE.md') },
      problem: { kind: 'discard-expectation' },
    },
    {
      name: 'a discard that expects a second file as well',
      intent: discard,
      expected: { files: files('README.md', 'GUIDE.md') },
      problem: { kind: 'discard-expectation' },
    },
    {
      name: 'a stash-create that states no expected files',
      intent: {
        action: 'stash-create',
        message: 'Park',
        includeUntracked: true,
      },
      expected: {},
      problem: { kind: 'missing-expected-files' },
    },
    {
      name: 'a stash-apply that states no expected files',
      intent: { action: 'stash-apply', stashOid, restoreIndex: false },
      expected: {},
      problem: { kind: 'missing-expected-files' },
    },
    {
      name: 'a fetch that does not state the upstream',
      intent: { action: 'fetch', ...remote },
      expected: {},
      problem: { kind: 'missing-upstream-expectation' },
    },
    {
      name: 'a pull that does not state the upstream',
      intent: { action: 'pull', ...remote },
      expected: {},
      problem: { kind: 'missing-upstream-expectation' },
    },
    {
      name: 'a push that does not state the upstream',
      intent: {
        action: 'push',
        remoteName: 'origin',
        destinationRef: 'refs/heads/main',
        allowCreate: false,
      },
      expected: {},
      problem: { kind: 'missing-upstream-expectation' },
    },
  ])('finds a problem in $name', ({ intent, expected, problem }) => {
    expect(gitActionProblem(intent, expected)).toEqual(problem);
  });

  it.each<Row>([
    {
      name: 'a local action with nothing expected',
      intent: branch,
      expected: {},
      problem: undefined,
    },
    {
      name: 'a commit whose expected files are the selection in another order',
      intent: { action: 'commit', message: 'Fix', paths: ['a.md', 'b.md'] },
      expected: { files: files('b.md', 'a.md') },
      problem: undefined,
    },
    {
      name: 'a merge commit whose expected files include more than the selection',
      intent: { action: 'commit', message: 'Merge', paths: ['a.md'] },
      expected: { ...merging, files: files('a.md', 'b.md') },
      problem: undefined,
    },
    {
      name: 'a merge commit that selects no path',
      intent: { action: 'commit', message: 'Merge', paths: [] },
      expected: { ...merging, files: [] },
      problem: undefined,
    },
    {
      name: 'an amend that only rewrites the message',
      intent: { action: 'amend', message: 'Reword', paths: [] },
      expected: { files: [] },
      problem: undefined,
    },
    {
      name: 'a discard that expects exactly its path',
      intent: discard,
      expected: { files: files('README.md') },
      problem: undefined,
    },
    {
      name: 'a stash-pop that expects a clean worktree',
      intent: { action: 'stash-pop', stashOid, restoreIndex: false },
      expected: { files: [] },
      problem: undefined,
    },
    {
      name: 'a fetch that saw the upstream at a commit',
      intent: { action: 'fetch', ...remote },
      expected: { upstream: { oid: 'e'.repeat(40) } },
      problem: undefined,
    },
    {
      name: 'a push that saw the upstream as not existing yet',
      intent: {
        action: 'push',
        remoteName: 'origin',
        destinationRef: 'refs/heads/new',
        allowCreate: true,
      },
      expected: { upstream: {} },
      problem: undefined,
    },
  ])('accepts $name', ({ intent, expected }) => {
    expect(gitActionProblem(intent, expected)).toBeUndefined();
  });
});
