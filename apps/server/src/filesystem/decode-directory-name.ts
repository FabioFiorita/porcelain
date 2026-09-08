import { FileInspectionError } from './errors/file-inspection-error.ts';

export function decodeDirectoryName(name: unknown): string {
  // Node's Dir typings assume string names even with encoding: 'buffer'.
  if (!Buffer.isBuffer(name)) throw new Error('Expected a raw directory name');
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      name,
    );
  } catch (error) {
    throw new FileInspectionError('UNSUPPORTED_PATH', { cause: error });
  }
}
