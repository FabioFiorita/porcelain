import { describe, expect, it } from 'vitest';
import { fixture } from '../../../spec/fixtures/fixture.ts';
import { parseCommitRecord, parseCommitRecords } from './parse-commit.ts';

const page = fixture('log/page.txt').toString('utf8');

describe('parseCommitRecords', () => {
  it('reads every commit of a log page in order', () => {
    expect(parseCommitRecords(page)).toEqual([
      {
        oid: '1020846388014a1baa79eb360c9f66b704e7398b',
        parentOids: [
          'f4e8dd3408852fb71b1581394612bcf35e414dfc',
          '2ae5d06b609a87714093c240d9bf094dce123436',
        ],
        author: { name: 'T', timestamp: '2026-09-23T19:00:17-03:00' },
        subject: 'merge',
        subjectTruncated: false,
        body: null,
        bodyTruncated: false,
        refs: ['main'],
      },
      {
        oid: '2ae5d06b609a87714093c240d9bf094dce123436',
        parentOids: ['33a10b8b50f5f24c5623c50dea66a8901245b102'],
        author: { name: 'T', timestamp: '2026-09-23T19:00:17-03:00' },
        subject: 'upstream two',
        subjectTruncated: false,
        body: 'Body line',
        bodyTruncated: false,
        refs: ['origin/main', 'origin/HEAD'],
      },
      {
        oid: '33a10b8b50f5f24c5623c50dea66a8901245b102',
        parentOids: ['22228ea430e1b0aa37ac3bb19bfd3999547323e1'],
        author: { name: 'T', timestamp: '2026-09-23T19:00:17-03:00' },
        subject: 'upstream one',
        subjectTruncated: false,
        body: null,
        bodyTruncated: false,
        refs: [],
      },
      {
        oid: 'f4e8dd3408852fb71b1581394612bcf35e414dfc',
        parentOids: ['22228ea430e1b0aa37ac3bb19bfd3999547323e1'],
        author: { name: 'T', timestamp: '2026-09-23T19:00:17-03:00' },
        subject: 'ahead',
        subjectTruncated: false,
        body: null,
        bodyTruncated: false,
        refs: ['v1.0'],
      },
      {
        oid: '22228ea430e1b0aa37ac3bb19bfd3999547323e1',
        parentOids: [],
        author: { name: 'T', timestamp: '2026-09-23T19:00:17-03:00' },
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
    expect(() =>
      parseCommitRecords(fixture('log/page-truncated.txt').toString('utf8')),
    ).toThrow('History contains unsupported data');
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
