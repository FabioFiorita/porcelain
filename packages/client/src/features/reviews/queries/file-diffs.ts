import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { textQueryOptions } from '../../files/queries/text.ts';
import { addedFilePatch } from '../rules/files.ts';

export function untrackedFileDiffQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  path: string,
) {
  return {
    ...textQueryOptions(scope, connection, path),
    select: (
      file: Awaited<ReturnType<ReturnType<typeof textQueryOptions>['queryFn']>>,
    ) =>
      'text' in file
        ? { kind: 'text' as const, patch: addedFilePatch(file.text) }
        : { kind: 'unavailable' as const, reason: file.reason },
  };
}
