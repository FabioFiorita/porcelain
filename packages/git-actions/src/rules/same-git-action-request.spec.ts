import type {
  AcceptGitActionInput,
  GitActionReceipt,
} from '@porcelain/git-actions/models';
import { describe, expect, it } from 'vitest';
import { sameGitActionRequest } from './same-git-action-request.ts';

const expected = {
  headOid: '6542f48d7482ef20646ce631f9df7ecf1278bae7',
  branch: 'main',
  files: [{ path: 'README.md', fingerprint: 'a'.repeat(64) }],
};
const request: AcceptGitActionInput = {
  projectId: '7aa691a4-9258-4a49-b1d1-5804ff5fe049',
  worktreeId: '3390d5008808ff5d45438db4708581b9',
  requestId: '68044b95-e9a8-44d1-bdbf-e7b806c901a6',
  intent: { action: 'commit', message: 'Fix', paths: ['README.md'] },
  expected: { ...expected, inProgress: undefined, mergeHeadOid: undefined },
};
const stored: GitActionReceipt = {
  requestId: request.requestId,
  projectId: request.projectId,
  worktreeId: request.worktreeId,
  action: 'commit',
  intent: { action: 'commit', message: 'Fix', paths: ['README.md'] },
  expected,
  state: 'succeeded',
  progress: [],
  refreshRequired: false,
  acceptedAt: '2026-09-01T10:00:00.000Z',
};

describe('sameGitActionRequest', () => {
  it('recognises the request a stored receipt was accepted for, whatever absent fields it spells out', () => {
    expect(sameGitActionRequest(stored, structuredClone(request))).toBe(true);
  });

  it('tells apart a request with another message, expectation or scope', () => {
    for (const other of [
      { ...request, intent: { ...request.intent, message: 'Other' } },
      { ...request, expected: { ...request.expected, branch: 'feature' } },
      { ...request, worktreeId: 'f'.repeat(32) },
      { ...request, projectId: '11111111-1111-4111-8111-111111111111' },
    ])
      expect(sameGitActionRequest(stored, other)).toBe(false);
  });
});
