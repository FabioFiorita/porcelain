import { isRelativePath } from '@porcelain/kernel/relative-path';
import { Schema } from 'effect';
import { PATH_LENGTH } from './limits.ts';

export const relativePathSchema = Schema.String.check(Schema.isMinLength(1))
  .check(Schema.isMaxLength(PATH_LENGTH))
  .check(
    Schema.makeFilter((path: string) => isRelativePath(path, PATH_LENGTH), {
      expected: 'Expected a normalized relative path',
    }),
  );
