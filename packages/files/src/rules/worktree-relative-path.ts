const MAX_PATH_LENGTH = 4096;
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

export function isWorktreeRelativePath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= MAX_PATH_LENGTH &&
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
      )
  );
}
