import { describe, expect, it } from 'vitest';
import { branchFile } from '../../spec/fixtures/branch-files.ts';
import {
  branchFilePath,
  fingerprintBranchFile,
} from './fingerprint-branch-file.ts';

describe('fingerprintBranchFile', () => {
  it('gives the same file on both sides the same fingerprint', () => {
    expect(fingerprintBranchFile(branchFile())).toBe(
      fingerprintBranchFile(branchFile()),
    );
    expect(fingerprintBranchFile(branchFile())).toBe(
      'b760018fd0a1c5c5eb421a12dfe1238b7cbcbccd30e6c7e1234d1b79e9c53cfe',
    );
  });

  it('is a SHA-256 in hexadecimal', () => {
    expect(fingerprintBranchFile(branchFile())).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('changes when the branch changes the file again', () => {
    expect(
      fingerprintBranchFile(branchFile({ newOid: 'b'.repeat(40) })),
    ).not.toBe(fingerprintBranchFile(branchFile()));
  });

  it('changes when the base side of the file is different', () => {
    expect(
      fingerprintBranchFile(branchFile({ oldOid: 'c'.repeat(40) })),
    ).not.toBe(fingerprintBranchFile(branchFile()));
  });

  it('changes when only the mode changes', () => {
    expect(fingerprintBranchFile(branchFile({ newMode: '100755' }))).not.toBe(
      fingerprintBranchFile(branchFile()),
    );
  });

  it('tells a rename apart from the same content added under the new name', () => {
    const renamed = branchFile({
      status: 'renamed',
      oldPath: 'old.txt',
      newPath: 'new.txt',
    });
    const added = branchFile({
      status: 'added',
      oldPath: undefined,
      newPath: 'new.txt',
      oldOid: undefined,
      oldMode: '000000',
    });
    expect(fingerprintBranchFile(renamed)).not.toBe(
      fingerprintBranchFile(added),
    );
  });
});

describe('branchFilePath', () => {
  it('names a file by where it ends up', () => {
    expect(
      branchFilePath(
        branchFile({ status: 'renamed', oldPath: 'a.txt', newPath: 'b.txt' }),
      ),
    ).toBe('b.txt');
  });

  it('names a deleted file by where it was', () => {
    expect(
      branchFilePath(
        branchFile({
          status: 'deleted',
          newPath: undefined,
          newOid: undefined,
        }),
      ),
    ).toBe('a.txt');
  });
});
