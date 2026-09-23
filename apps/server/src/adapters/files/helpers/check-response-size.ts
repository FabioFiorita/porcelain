import type { DirectoryListing, TextContent } from '@porcelain/files/models';
import { FileInspectionError } from '@porcelain/files/errors';

export function checkResponseSize(
  value: DirectoryListing | TextContent,
  code: 'DIRECTORY_TOO_LARGE' | 'FILE_TOO_LARGE',
  maxBytes: number,
) {
  if (Buffer.byteLength(JSON.stringify(value)) > maxBytes)
    throw new FileInspectionError(code);
}
