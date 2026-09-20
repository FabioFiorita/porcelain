import { describe, expect, it } from 'vitest';
import { UnsupportedHistoryDataError } from '../errors/unsupported-history-data-error.ts';
import { headFromDecoration, parseCommitRecords } from './parse-commit.ts';

const oid = 'a'.repeat(40);
const parent = 'b'.repeat(40);
const record = (
  fields: Partial<{
    oid: string;
    parents: string;
    name: string;
    authored: string;
    decoration: string;
    subject: string;
    body: string;
  }> = {},
) =>
  [
    fields.oid ?? oid,
    fields.parents ?? parent,
    fields.name ?? 'Ada Lovelace',
    fields.authored ?? '2026-01-02T03:04:05+00:00',
    fields.decoration ?? '',
    fields.subject ?? 'Subject',
    fields.body ?? '',
  ].join('\0');

/** `-z` terminates every record, including the last one. */
const stream = (...records: string[]) => `${records.join('\0')}\0`;

describe('parseCommitRecords', () => {
  it('reads a record into a commit', () => {
    const [commit] = parseCommitRecords(stream(record()));
    expect(commit?.summary).toMatchObject({
      oid,
      parentOids: [parent],
      author: { name: 'Ada Lovelace', timestamp: '2026-01-02T03:04:05.000Z' },
      subject: 'Subject',
      subjectTruncated: false,
      body: null,
      bodyTruncated: false,
    });
  });

  /**
   * The body is the last field of a record and is empty for most commits, so
   * a reader that trims trailing empty fields loses the final commit.
   */
  it('keeps a last commit whose body is empty', () => {
    const commits = parseCommitRecords(
      stream(
        record({ subject: 'first', body: 'has a body' }),
        record({ subject: 'last' }),
      ),
    );
    expect(commits.map((entry) => entry.summary.subject)).toEqual([
      'first',
      'last',
    ]);
    expect(commits[1]?.summary.body).toBeNull();
  });

  it('keeps body line breaks and indentation', () => {
    const [commit] = parseCommitRecords(
      stream(record({ body: 'first line\n\n  second line\n' })),
    );
    expect(commit?.summary.body).toBe('first line\n\n  second line');
  });

  it('truncates the body at a valid UTF-8 boundary', () => {
    const [commit] = parseCommitRecords(
      stream(record({ body: `${'a'.repeat(4095)}😀` })),
    );
    expect(commit?.summary.body).toBe('a'.repeat(4095));
    expect(commit?.summary.bodyTruncated).toBe(true);
  });

  it('reads no commits from an empty answer', () => {
    expect(parseCommitRecords('')).toEqual([]);
  });

  it('refuses an answer that does not divide into whole records', () => {
    expect(() => parseCommitRecords(`${oid}\0${parent}\0`)).toThrow(
      UnsupportedHistoryDataError,
    );
  });

  it('refuses an unreadable object id or timestamp', () => {
    expect(() => parseCommitRecords(stream(record({ oid: 'nope' })))).toThrow(
      UnsupportedHistoryDataError,
    );
    expect(() =>
      parseCommitRecords(stream(record({ authored: 'not a date' }))),
    ).toThrow(UnsupportedHistoryDataError);
  });

  it('takes the refs from the decoration, without HEAD and without the tag marker', () => {
    const [commit] = parseCommitRecords(
      stream(record({ decoration: 'HEAD -> main, origin/main, tag: v1.2.0' })),
    );
    expect(commit?.summary.refs).toEqual(['main', 'origin/main', 'v1.2.0']);
  });

  it('reads a commit with no parents', () => {
    const [commit] = parseCommitRecords(stream(record({ parents: '' })));
    expect(commit?.summary.parentOids).toEqual([]);
  });
});

describe('headFromDecoration', () => {
  it('reads an attached branch', () => {
    expect(headFromDecoration(oid, 'HEAD -> main, tag: v1')).toEqual({
      tipOid: oid,
      head: { kind: 'attached', ref: 'refs/heads/main' },
    });
  });

  it('reads a detached HEAD', () => {
    expect(headFromDecoration(oid, 'HEAD, origin/main')).toEqual({
      tipOid: oid,
      head: { kind: 'detached' },
    });
  });

  it('refuses a newest commit that HEAD does not point at', () => {
    expect(() => headFromDecoration(oid, 'origin/main')).toThrow(
      UnsupportedHistoryDataError,
    );
  });
});
