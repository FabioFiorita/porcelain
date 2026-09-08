import { FileInspectionError } from '../filesystem/errors/file-inspection-error.ts';
export function validateFilePath(path: string, directory: boolean) {
  if (path === '' && directory) return;
  if (
    path.length > 4096 ||
    path.includes('\\') ||
    path.includes('\0') ||
    /^[a-z]:/i.test(path) ||
    path.split('/').some((part) => part === '' || part === '.' || part === '..')
  )
    throw new FileInspectionError('INVALID_REQUEST');
  if (path.split('/').some((part) => part.toLowerCase() === '.git'))
    throw new FileInspectionError('PATH_NOT_READABLE');
}
