import { describe, expect, it } from 'vitest';
import { fixture } from '../../../spec/fixtures/fixture.ts';
import { parseCommitRecord, parseCommitRecords } from './parse-commit.ts';

const page = fixture('log/page.txt').toString('utf8');

describe('parseCommitRecords', () => {
  it('reads every commit of a log page in order', () => {
    expect(parseCommitRecords(page)).toEqual([
      {
        oid: 'eb7312add608affdf32a090cfc5991b6b0673e1e',
        parentOids: [
          '847c4a56aa33b6452cc83525965eb3a8463d2658',
          '51461c37b4684d691ef47cc707936a782af61d13',
        ],
        author: { name: 'T', timestamp: '2026-09-23T22:00:17.000Z' },
        subject: 'merge',
        subjectTruncated: false,
        body: null,
        bodyTruncated: false,
        refs: ['main'],
      },
      {
        oid: '51461c37b4684d691ef47cc707936a782af61d13',
        parentOids: ['55a7889b7826882e28bdf4641cc6f09db55b3a2c'],
        author: { name: 'T', timestamp: '2026-09-23T22:00:17.000Z' },
        subject: 'upstream two',
        subjectTruncated: false,
        body: 'Body line',
        bodyTruncated: false,
        refs: ['origin/main', 'origin/HEAD'],
      },
      {
        oid: '55a7889b7826882e28bdf4641cc6f09db55b3a2c',
        parentOids: ['aa1c1b46ec8e9f679d429c3f9c8f647d341654f8'],
        author: { name: 'T', timestamp: '2026-09-23T22:00:17.000Z' },
        subject: 'upstream one',
        subjectTruncated: false,
        body: null,
        bodyTruncated: false,
        refs: [],
      },
      {
        oid: '847c4a56aa33b6452cc83525965eb3a8463d2658',
        parentOids: ['aa1c1b46ec8e9f679d429c3f9c8f647d341654f8'],
        author: { name: 'T', timestamp: '2026-09-23T22:00:17.000Z' },
        subject: 'ahead',
        subjectTruncated: false,
        body: null,
        bodyTruncated: false,
        refs: ['v1.0'],
      },
      {
        oid: 'aa1c1b46ec8e9f679d429c3f9c8f647d341654f8',
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
