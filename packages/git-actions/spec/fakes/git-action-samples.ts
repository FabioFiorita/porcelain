import type { GitActionExpectation } from '../../src/models/git-action-expectation.ts';
import type { GitActionIntent } from '../../src/models/git-action-intent.ts';
import type { GitActionReceipt } from '../../src/models/git-action-receipt.ts';
import type {
  GitActionRun,
  GitActionTarget,
} from '../../src/models/git-action-run.ts';

export const PROJECT_ID = '7aa691a4-9258-4a49-b1d1-5804ff5fe049';
export const WORKTREE_ID = '3390d5008808ff5d45438db4708581b9';
export const REQUEST_ID = '68044b95-e9a8-44d1-bdbf-e7b806c901a6';
export const HEAD_OID = '6542f48d7482ef20646ce631f9df7ecf1278bae7';
export const README_FINGERPRINT = 'a'.repeat(64);
export const GUIDE_FINGERPRINT = 'b'.repeat(64);
export const ACCEPTED_AT = '2026-09-01T10:00:00.000Z';

export const CLEAN_EXPECTATION: GitActionExpectation = {
  headOid: HEAD_OID,
  branch: 'main',
};

export function sampleRun(
  intent: GitActionIntent,
  expected: GitActionExpectation = CLEAN_EXPECTATION,
  target: GitActionTarget = { kind: 'unchecked' },
): GitActionRun {
  return {
    requestId: REQUEST_ID,
    projectId: PROJECT_ID,
    worktreeId: WORKTREE_ID,
    intent,
    expected,
    target,
  };
}

export function sampleReceipt(
  overrides: Partial<GitActionReceipt> = {},
): GitActionReceipt {
  return {
    requestId: REQUEST_ID,
    projectId: PROJECT_ID,
    worktreeId: WORKTREE_ID,
    action: 'create-branch',
    intent: { action: 'create-branch', branch: 'feature', switchTo: false },
    expected: CLEAN_EXPECTATION,
    state: 'running',
    progress: [],
    refreshRequired: false,
    acceptedAt: ACCEPTED_AT,
    ...overrides,
  };
}
