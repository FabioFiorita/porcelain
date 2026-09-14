import { describe, expect, it } from 'vitest';
import { parseCommit } from './parse-commit.ts';

const oid = 'a'.repeat(40);
const rawCommit = (message: string) =>
  [
    `tree ${'b'.repeat(40)}`,
    'author Ada Lovelace <ada@example.test> 0 +0000',
    'committer Ada Lovelace <ada@example.test> 0 +0000',
    '',
    message,
  ].join('\n');

describe('parseCommit', () => {
  it('separates a subject from an absent or empty body', () => {
    expect(parseCommit(oid, rawCommit('Subject\n')).body).toBeNull();
    expect(parseCommit(oid, rawCommit('Subject\n\n')).body).toBeNull();
    expect(parseCommit(oid, rawCommit('Subject\n')).bodyTruncated).toBe(false);
  });

  it('keeps body line breaks and indentation', () => {
    expect(
      parseCommit(oid, rawCommit('Subject\n\nfirst line\n\n  second line\n')),
    ).toMatchObject({
      subject: 'Subject',
      body: 'first line\n\n  second line',
      bodyTruncated: false,
    });
  });

  it('truncates the body at a valid UTF-8 boundary', () => {
    const body = `${'a'.repeat(4095)}😀`;
    const result = parseCommit(oid, rawCommit(`Subject\n\n${body}`));
    expect(result.body).toBe('a'.repeat(4095));
    expect(result.bodyTruncated).toBe(true);
  });
});
