import { describe, expect, it } from 'vitest';
import { fingerprintChange } from './fingerprint-change.ts';
import { modified, unmerged } from '../../spec/fakes/comparisons.ts';

const sampleDigest =
  '5805fc9b5cf5a14cea6b2274b2ef5afac4bf9261823de0a3e94ead6c915f6baf';
const sampleFingerprint =
  '68ae39995d04b18f57dacf53b58c6c21f44a6a9a9cd6f1085d932da25530dcce';

describe('fingerprintChange', () => {
  it('keeps the fingerprint clients and reviewed marks already hold for an unstaged edit', () => {
    expect(
      fingerprintChange(
        'README.md',
        [modified('unstaged', 'README.md')],
        new Map([['README.md', { digest: sampleDigest }]]),
      ),
    ).toBe(sampleFingerprint);
  });

  it('changes when the worktree content changes', () => {
    expect(
      fingerprintChange(
        'README.md',
        [modified('unstaged', 'README.md')],
        new Map([['README.md', { digest: 'f'.repeat(64) }]]),
      ),
    ).not.toBe(sampleFingerprint);
  });

  it('changes when the same content is staged instead', () => {
    expect(
      fingerprintChange(
        'README.md',
        [modified('staged', 'README.md', '9'.repeat(40))],
        new Map(),
      ),
    ).not.toBe(sampleFingerprint);
  });

  it('has no fingerprint when the worktree side of an unstaged edit could not be read', () => {
    expect(
      fingerprintChange(
        'README.md',
        [modified('unstaged', 'README.md')],
        new Map(),
      ),
    ).toBeUndefined();
  });

  it('has no fingerprint for an untracked file it could not read', () => {
    expect(
      fingerprintChange(
        'notes.txt',
        [{ scope: 'untracked', path: 'notes.txt' }],
        new Map(),
      ),
    ).toBeUndefined();
  });

  it('has no fingerprint for a staged addition whose blob is unknown', () => {
    expect(
      fingerprintChange(
        'new.md',
        [
          {
            ...modified('staged', 'new.md'),
            kind: 'added',
            oldPath: undefined,
          },
        ],
        new Map(),
      ),
    ).toBeUndefined();
  });

  it('fingerprints a staged deletion without any worktree side', () => {
    expect(
      fingerprintChange(
        'gone.md',
        [
          {
            ...modified('staged', 'gone.md'),
            kind: 'deleted',
            newPath: undefined,
          },
        ],
        new Map(),
      ),
    ).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fingerprints a conflict whose worktree file is missing', () => {
    const missing = fingerprintChange(
      'clash.md',
      [unmerged('clash.md')],
      new Map(),
    );
    const present = fingerprintChange(
      'clash.md',
      [unmerged('clash.md')],
      new Map([['clash.md', { digest: sampleDigest }]]),
    );
    expect(missing).toMatch(/^[0-9a-f]{64}$/);
    expect(present).not.toBe(missing);
  });

  it('prefers a symlink target over a digest for the same path', () => {
    const link = fingerprintChange(
      'link',
      [{ scope: 'untracked', path: 'link' }],
      new Map([['link', { symlink: 'target', digest: sampleDigest }]]),
    );
    const plain = fingerprintChange(
      'link',
      [{ scope: 'untracked', path: 'link' }],
      new Map([['link', { symlink: 'target' }]]),
    );
    expect(link).toBe(plain);
  });
});
