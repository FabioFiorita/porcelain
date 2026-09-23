import { z } from 'zod';

const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

export const relativePathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (path) =>
      !path.includes('\0') &&
      !path.includes('\\') &&
      !/^[A-Za-z]:/.test(path) &&
      !LONE_SURROGATE.test(path) &&
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

export type RelativePath = z.output<typeof relativePathSchema>;
