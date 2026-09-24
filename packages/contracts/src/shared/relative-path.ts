import { z } from 'zod';
import { PATH_LENGTH } from './limits.ts';

export const relativePathSchema = z
  .string()
  .min(1)
  .max(PATH_LENGTH)
  .refine(
    (path) =>
      !path.includes('\0') &&
      !path.includes('\\') &&
      !/^[A-Za-z]:/.test(path) &&
      path.isWellFormed() &&
      path
        .split('/')
        .every(
          (part) =>
            part !== '' &&
            part !== '.' &&
            part !== '..' &&
            part.toLowerCase() !== '.git',
        ),
    'Expected a normalized relative path',
  );
