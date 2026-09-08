import { expect, it } from 'vitest';
import { InvalidGitStatusError } from '../errors/invalid-git-status-error.ts';
import { UnsupportedPathEncodingError } from '../errors/unsupported-path-encoding-error.ts';
import { parseGitStatus } from './parse-git-status.ts';

it('preserves unusual path bytes and rejects malformed records instead of producing wrong identities', () => {
  const header = '# branch.oid (initial)\0';
  expect(
    parseGitStatus(Buffer.from(`${header}? leading space \t\nfile\0`)).changes,
  ).toEqual([{ scope: 'untracked', path: 'leading space \t\nfile' }]);
  for (const suffix of [
    '? missing terminator',
    'x unknown\0',
    'u XX N... 0 0 0 0 x x x file\0',
    '2 R. N... 100644 100644 100644 a b R100 new\0',
  ]) {
    expect(() => parseGitStatus(Buffer.from(header + suffix))).toThrow();
  }
  expect(() => parseGitStatus(Buffer.from('? no head\0'))).toThrow(
    InvalidGitStatusError,
  );
  expect(() =>
    parseGitStatus(
      Buffer.concat([Buffer.from(`${header}? `), Buffer.from([0xff, 0])]),
    ),
  ).toThrow(UnsupportedPathEncodingError);
});
