import { FileInspectionError } from './errors/file-inspection-error.ts';
export function mapFilesystemError(error: unknown): never {
  if (error instanceof Error && 'code' in error) {
    if (error.code === 'ENOENT')
      throw new FileInspectionError('PATH_NOT_FOUND', { cause: error });
    if (
      ['EACCES', 'EPERM', 'ELOOP', 'ENOTDIR', 'EISDIR', 'ENXIO'].includes(
        String(error.code),
      )
    )
      throw new FileInspectionError('PATH_NOT_READABLE', { cause: error });
  }
  throw error;
}
