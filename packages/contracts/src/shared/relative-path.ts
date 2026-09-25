import { z } from 'zod';
import { PATH_LENGTH } from './limits.ts';

const loneSurrogate =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

function isRelativePath(path: string, maxLength: number): boolean {
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

export const relativePathSchema = z
  .string()
  .min(1)
  .max(PATH_LENGTH)
  .refine(
    (path) => isRelativePath(path, PATH_LENGTH),
    'Expected a normalized relative path',
  );
