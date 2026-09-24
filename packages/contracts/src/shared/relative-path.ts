import { z } from 'zod';

export const relativePathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (path) =>
      !path.includes('\0') &&
      !path.includes('\\') &&
      !/^[A-Za-z]:/.test(path) &&
      path.isWellFormed() &&
      path
        .split('/')
        .every((part) => part !== '' && part !== '.' && part !== '..'),
    'Expected a normalized relative path',
  );
