import type {
  DirectoryResponse,
  TextResponse,
} from '@porcelain/contracts/files';
import type {
  DirectoryListing,
  TextContent,
} from '../../models/file-content.ts';
export function toDirectoryResponse(
  value: DirectoryListing,
): DirectoryResponse {
  return {
    worktreeId: value.worktreeId,
    path: value.path,
    entries: value.entries.map(({ name, kind }) => ({ name, kind })),
  };
}
export function toTextResponse(value: TextContent): TextResponse {
  return {
    worktreeId: value.worktreeId,
    path: value.path,
    encoding: value.encoding,
    byteLength: value.byteLength,
    text: value.text,
  };
}
