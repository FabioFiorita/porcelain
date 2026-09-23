import { FileInspectionError } from '@porcelain/files/errors';

export function decodeDirectoryName(name: unknown): string {
  if (!Buffer.isBuffer(name)) throw new Error('Expected a raw directory name');
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      name,
    );
  } catch (error) {
    throw new FileInspectionError('UNSUPPORTED_PATH', { cause: error });
  }
}
