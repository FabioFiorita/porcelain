import { Schema } from 'effect';
import { PATH_LENGTH } from './limits.ts';

const loneSurrogate =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

export function isRelativePath(path: string, maxLength: number): boolean {
  return (
    path.length > 0 &&
    path.length <= maxLength &&
    !path.includes('\0') &&
    !path.includes('\\') &&
    !/^[A-Za-z]:/.test(path) &&
    !loneSurrogate.test(path) &&
    path
      .split('/')
      .every(
        (part) =>
          part !== '' &&
          part !== '.' &&
          part !== '..' &&
          part.toLowerCase() !== '.git',
      )
  );
}

export const relativePathSchema = Schema.String.check(Schema.isMinLength(1))
  .check(Schema.isMaxLength(PATH_LENGTH))
  .check(
    Schema.makeFilter((path: string) => isRelativePath(path, PATH_LENGTH), {
      expected: 'Expected a normalized relative path',
    }),
  );
