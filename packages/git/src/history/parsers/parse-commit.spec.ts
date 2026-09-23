import { describe, expect, it } from 'vitest';
import { parseCommitRecord, parseCommitRecords } from './parse-commit.ts';

const log =
  '2a3a1e5faca6d0d4d95b3b74458f7959633c9abe\x006c1b860d27b09e27478a7e1cd13377dc66dc1dec\0T\x002026-09-23T19:00:17-03:00\0main, tag: v1.0\0ahead\0\0' +
  '6c1b860d27b09e27478a7e1cd13377dc66dc1dec\0ccdc14ed14529c0ed2856043769bdf9297be052f 1111111111111111111111111111111111111111\0T\x002026-09-23T19:00:17-03:00\0origin/main, origin/HEAD\0merge\0Body line\n\n\0' +
  'ccdc14ed14529c0ed2856043769bdf9297be052f\0\0T\x002026-09-23T19:00:17-03:00\0\0base\0\0';

describe('parseCommitRecords', () => {
  it('reads every commit of a log page in order', () => {
    expect(parseCommitRecords(log)).toEqual([
      {
        oid: '2a3a1e5faca6d0d4d95b3b74458f7959633c9abe',
        parentOids: ['6c1b860d27b09e27478a7e1cd13377dc66dc1dec'],
        author: { name: 'T', timestamp: '2026-09-23T22:00:17.000Z' },
        subject: 'ahead',
        subjectTruncated: false,
        body: null,
        bodyTruncated: false,
        refs: ['main', 'v1.0'],
      },
      {
        oid: '6c1b860d27b09e27478a7e1cd13377dc66dc1dec',
        parentOids: [
          'ccdc14ed14529c0ed2856043769bdf9297be052f',
          '1111111111111111111111111111111111111111',
        ],
        author: { name: 'T', timestamp: '2026-09-23T22:00:17.000Z' },
        subject: 'merge',
        subjectTruncated: false,
        body: 'Body line',
        bodyTruncated: false,
        refs: ['origin/main', 'origin/HEAD'],
      },
      {
        oid: 'ccdc14ed14529c0ed2856043769bdf9297be052f',
        parentOids: [],
        author: { name: 'T', timestamp: '2026-09-23T22:00:17.000Z' },
        subject: 'base',
        subjectTruncated: false,
        body: null,
        bodyTruncated: false,
        refs: [],
      },
    ]);
  });

  it('reads an empty log as no commits', () => {
    expect(parseCommitRecords('')).toEqual([]);
  });

  it('rejects a log cut off in the middle of a commit', () => {
    expect(() => parseCommitRecords(log.slice(0, 60))).toThrow(
      'History contains unsupported data',
    );
  });
});

describe('parseCommitRecord', () => {
  const fields = (overrides: Partial<Record<number, string>>) =>
    [
      'ccdc14ed14529c0ed2856043769bdf9297be052f',
      '',
      'T',
      '2026-09-23T19:00:17-03:00',
      'HEAD -> main',
      'subject',
      '',
    ].map((value, index) => overrides[index] ?? value);

  it('drops HEAD from the refs and keeps the branch it points at', () => {
    expect(parseCommitRecord(fields({})).refs).toEqual(['main']);
  });

  it('truncates a long subject on a character boundary', () => {
    const commit = parseCommitRecord(fields({ 5: `${'a'.repeat(511)}é tail` }));
    expect([commit.subject, commit.subjectTruncated]).toEqual([
      'a'.repeat(511),
      true,
    ]);
  });

  it('truncates a long body and says so', () => {
    const commit = parseCommitRecord(fields({ 6: 'b'.repeat(5000) }));
    expect([commit.body?.length, commit.bodyTruncated]).toEqual([4096, true]);
  });

  it('rejects an abbreviated object name and an unreadable date', () => {
    expect(() => parseCommitRecord(fields({ 0: 'ccdc14e' }))).toThrow(
      'History contains unsupported data',
    );
    expect(() => parseCommitRecord(fields({ 3: 'yesterday' }))).toThrow(
      'History contains unsupported data',
    );
  });

  it('rejects a record with missing fields', () => {
    expect(() => parseCommitRecord(fields({}).slice(0, 6))).toThrow(
      'History contains unsupported data',
    );
  });
});
