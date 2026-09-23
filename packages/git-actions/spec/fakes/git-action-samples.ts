import type {
  GitActionExpectation,
  GitActionIntent,
  GitActionReceipt,
  GitActionRun,
} from '../../src/models/index.ts';

export const projectId = '7aa691a4-9258-4a49-b1d1-5804ff5fe049';
export const worktreeId = '3390d5008808ff5d45438db4708581b9';
export const headOid = '6542f48d7482ef20646ce631f9df7ecf1278bae7';
export const readmeFingerprint = 'a'.repeat(64);
export const guideFingerprint = 'b'.repeat(64);

export const cleanExpectation: GitActionExpectation = {
  headOid,
  branch: 'main',
};

export function sampleRun(
  intent: GitActionIntent,
  expected: GitActionExpectation = cleanExpectation,
): GitActionRun {
  return {
    requestId: '68044b95-e9a8-44d1-bdbf-e7b806c901a6',
    projectId,
    worktreeId,
    intent,
    expected,
  };
}

export function sampleReceipt(
  overrides: Partial<GitActionReceipt> = {},
): GitActionReceipt {
  return {
    requestId: '68044b95-e9a8-44d1-bdbf-e7b806c901a6',
    projectId,
    worktreeId,
    action: 'create-branch',
    intent: { action: 'create-branch', branch: 'feature', switchTo: false },
    expected: cleanExpectation,
    state: 'running',
    progress: [],
    refreshRequired: false,
    acceptedAt: Date.parse('2026-09-01T10:00:00.000Z'),
    ...overrides,
  };
}
