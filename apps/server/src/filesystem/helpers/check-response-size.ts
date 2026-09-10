import type {
  DirectoryListing,
  TextContent,
} from '../../models/file-content.ts';
import { FileInspectionError } from '../errors/file-inspection-error.ts';

export function checkResponseSize(
  value: DirectoryListing | TextContent,
  code: 'DIRECTORY_TOO_LARGE' | 'FILE_TOO_LARGE',
  maxBytes: number,
) {
  if (Buffer.byteLength(JSON.stringify(value)) > maxBytes)
    throw new FileInspectionError(code);
}
