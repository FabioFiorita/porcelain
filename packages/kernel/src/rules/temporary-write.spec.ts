import { describe, expect, it } from 'vitest';
import { isTemporaryWrite, temporaryWriteName } from './temporary-write.ts';

const id = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('temporaryWriteName', () => {
  it('names a hidden file that isTemporaryWrite recognises', () => {
    expect(isTemporaryWrite(temporaryWriteName(id))).toBe(true);
  });
});

describe('isTemporaryWrite', () => {
  it('recognises a temporary write inside a folder', () => {
    expect(isTemporaryWrite(`src/${temporaryWriteName(id)}`)).toBe(true);
  });

  it('leaves the file being written alone', () => {
    expect(isTemporaryWrite('README.md')).toBe(false);
  });

  it('leaves a file that only resembles a temporary write alone', () => {
    expect(isTemporaryWrite('.porcelain-notes.tmp')).toBe(false);
  });

  it('leaves a folder named like a temporary write alone', () => {
    expect(isTemporaryWrite(`${temporaryWriteName(id)}/inner.md`)).toBe(false);
  });
});
