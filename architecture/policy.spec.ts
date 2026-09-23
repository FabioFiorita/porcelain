import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gitCapabilityViolation } from './policy.ts';

void describe('Git capability dependency order', () => {
  void it('allows actions to use inspection and every capability to use shared', () => {
    assert.equal(
      gitCapabilityViolation(
        'packages/git/src/actions/action-git.ts',
        'packages/git/src/inspection/index.ts',
      ),
      undefined,
    );
    assert.equal(
      gitCapabilityViolation(
        'packages/git/src/discovery/git.ts',
        'packages/git/src/shared/run-git.ts',
      ),
      undefined,
    );
  });

  void it('rejects dependencies that create a capability cycle', () => {
    assert.equal(
      gitCapabilityViolation(
        'packages/git/src/inspection/read-status.ts',
        'packages/git/src/actions/action-git.ts',
      ),
      'git-capability-dependency-order',
    );
    assert.equal(
      gitCapabilityViolation(
        'packages/git/src/shared/run-git.ts',
        'packages/git/src/actions/action-git.ts',
      ),
      'git-capability-dependency-order',
    );
  });
});
