import { isRelativePath } from '@porcelain/kernel/rules';
import { z } from 'zod';
import { PATH_LENGTH } from './limits.ts';

export const relativePathSchema = z
  .string()
  .min(1)
  .max(PATH_LENGTH)
  .refine(
    (path) => isRelativePath(path, PATH_LENGTH),
    'Expected a normalized relative path',
  );
