import { expect, it } from 'vitest';
import { decodeDirectoryName } from './decode-directory-name.ts';

it.each([
  Buffer.from([0xff]),
  Buffer.from([0xfe]),
  Buffer.from([0xc3]),
  Buffer.from([0xc0, 0xaf]),
])(
  'rejects invalid filename bytes instead of collapsing names to replacement characters',
  (bytes) => {
    expect(() => decodeDirectoryName(bytes)).toThrow(
      expect.objectContaining({ code: 'UNSUPPORTED_PATH' }),
    );
  },
);

it.each(['plain.ts', 'olá-世界', '\ufffd', '\ufeffname'])(
  'preserves valid filename %s byte-for-byte',
  (name) => {
    const bytes = Buffer.from(name);
    expect(Buffer.from(decodeDirectoryName(bytes))).toEqual(bytes);
  },
);
