import { temporaryRoot } from '@porcelain/kernel/test-kit/temporary-root';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { readReviewPatch } from './review-patch.ts';

function git(directory: string, ...args: string[]): string {
  return execFileSync('git', ['-C', directory, ...args], {
    encoding: 'utf8',
  }).trim();
}

function unavailableHostedPatch(): string {
  throw new Error('HTTP 406: diff exceeds the maximum 20000 lines');
}

describe('review patch', () => {
  it('delivers a large patch from the exact Git commits when GitHub refuses the diff', async () => {
    const remote = mkdtempSync(join(temporaryRoot, 'porcelain-review-remote-'));
    try {
      git(remote, 'init', '-q', '-b', 'main');
      git(remote, 'config', 'user.name', 'Review fixture');
      git(remote, 'config', 'user.email', 'review@example.test');
      git(remote, 'config', 'commit.gpgsign', 'false');
      writeFileSync(join(remote, 'seed.txt'), 'seed\n');
      git(remote, 'add', '.');
      git(remote, 'commit', '-qm', 'Create common ancestor');
      git(remote, 'checkout', '-qb', 'feature');
      writeFileSync(
        join(remote, 'large.txt'),
        Array.from(
          { length: 20_001 },
          (_, index) => `line ${index + 1}\n`,
        ).join(''),
      );
      git(remote, 'add', '.');
      git(remote, 'commit', '-qm', 'Add large file');
      const headSha = git(remote, 'rev-parse', 'HEAD');
      writeFileSync(join(remote, 'later.txt'), 'unreviewed later push\n');
      git(remote, 'add', '.');
      git(remote, 'commit', '-qm', 'Advance the feature branch');
      git(remote, 'checkout', '-q', 'main');
      writeFileSync(join(remote, 'main-only.txt'), 'unrelated main change\n');
      git(remote, 'add', '.');
      git(remote, 'commit', '-qm', 'Advance main');
      const baseSha = git(remote, 'rev-parse', 'HEAD');
      const patch = readReviewPatch(
        { remote, baseSha, headSha },
        unavailableHostedPatch,
      );
      expect(patch).toContain('@@ -0,0 +1,20001 @@');
      expect(patch).toContain('+line 1\n');
      expect(patch).toContain('+line 20001\n');
      expect(patch).not.toContain('later.txt');
      expect(patch).not.toContain('main-only.txt');
    } finally {
      rmSync(remote, { recursive: true, force: true });
    }
  });

  it('uses a hosted patch without needing a Git remote', () => {
    expect(
      readReviewPatch(
        { remote: '/does-not-exist', baseSha: 'base', headSha: 'head' },
        () => 'diff --git a/file b/file\n+change\n',
      ),
    ).toBe('diff --git a/file b/file\n+change\n');
  });

  it('leaves the gate closed when neither GitHub nor Git can supply the patch', () => {
    expect(
      readReviewPatch(
        { remote: '/does-not-exist', baseSha: 'base', headSha: 'head' },
        unavailableHostedPatch,
      ),
    ).toBeUndefined();
  });
});
