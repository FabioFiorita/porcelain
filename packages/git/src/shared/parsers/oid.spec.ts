import { describe, expect, it } from 'vitest';
import { isNullOid, isOid, nullOidFor } from './oid.ts';

const sha1 = 'a009a75e6294ff85720885cbc63f5ef03b85b3dd';
const sha256 =
  '3fa1f5d9b3c2e1a0f9e8d7c6b5a49382716f5e4d3c2b1a09f8e7d6c5b4a39281';

describe('isOid', () => {
  it('accepts a full SHA-1 and a full SHA-256 object name', () => {
    expect([isOid(sha1), isOid(sha256)]).toEqual([true, true]);
  });

  it('rejects abbreviated, over-long, in-between and empty names', () => {
    expect(
      [sha1.slice(0, 7), `${sha1}0`, `${sha1}${'0'.repeat(23)}`, ''].map(isOid),
    ).toEqual([false, false, false, false]);
  });

  it('rejects upper-case hex and names wrapped in whitespace', () => {
    expect([
      isOid(sha1.toUpperCase()),
      isOid(` ${sha1}`),
      isOid(`${sha1}\n`),
    ]).toEqual([false, false, false]);
  });
});

describe('isNullOid', () => {
  it('recognises the null object name of both hash lengths', () => {
    expect([isNullOid('0'.repeat(40)), isNullOid('0'.repeat(64))]).toEqual([
      true,
      true,
    ]);
  });

  it('does not treat a short run of zeros or a real name as null', () => {
    expect([isNullOid('0000000'), isNullOid(sha1)]).toEqual([false, false]);
  });
});

describe('nullOidFor', () => {
  it('matches the hash length of the object it guards', () => {
    expect([nullOidFor(sha1), nullOidFor(sha256)]).toEqual([
      '0'.repeat(40),
      '0'.repeat(64),
    ]);
  });
});
