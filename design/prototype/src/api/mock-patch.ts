import { createTwoFilesPatch } from 'diff';

/**
 * A git-style unified patch, the same text GitDiffResponse.content.patch and
 * CommitChange.patch carry, so views parse mock and live diffs identically.
 */
export function unifiedPatch(
  path: string,
  before: string | null,
  after: string | null,
): string {
  const oldName = before == null ? '/dev/null' : `a/${path}`;
  const newName = after == null ? '/dev/null' : `b/${path}`;
  const body = createTwoFilesPatch(
    oldName,
    newName,
    before ?? '',
    after ?? '',
    undefined,
    undefined,
    {
      context: 3,
    },
  )
    .split('\n')
    .filter((line) => !line.startsWith('==='))
    .join('\n');
  const mode =
    before == null
      ? 'new file mode 100644\n'
      : after == null
        ? 'deleted file mode 100644\n'
        : '';
  return `diff --git a/${path} b/${path}\n${mode}${body}`;
}
