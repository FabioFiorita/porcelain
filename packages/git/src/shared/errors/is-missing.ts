import { PlatformError } from 'effect';

export function isMissing(error: unknown): boolean {
  if (PlatformError.isPlatformError(error))
    return error.reason._tag === 'NotFound' || isMissing(error.reason.cause);
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}
