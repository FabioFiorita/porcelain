const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

export function isRelativePath(path: string, maxLength: number): boolean {
  return (
    path.length > 0 &&
    path.length <= maxLength &&
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
