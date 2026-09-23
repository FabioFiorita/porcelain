import { filePathError } from '../models/file-path.ts';
import { FileInspectionError } from './file-inspection-error.ts';

export function validateFilePath(path: string, directory: boolean): void {
  const code = filePathError(path, directory);
  if (code) throw new FileInspectionError(code);
}
