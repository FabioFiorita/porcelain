import type { ListReviewedFilesResponse } from '@porcelain/contracts/reviews';

export function fileReviewStatus(
  file: { path: string; fingerprint: string | undefined },
  marks: ListReviewedFilesResponse | undefined,
) {
  const mark = marks?.marks.find((candidate) => candidate.path === file.path);
  return !file.fingerprint || !mark
    ? 'Unreviewed'
    : mark.fingerprint === file.fingerprint
      ? 'Reviewed'
      : 'Changed since review';
}

export function addedFilePatch(text: string) {
  if (text === '') return '';
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return (
    lines.map((line) => `+${line}`).join('\n') +
    (text.endsWith('\n') ? '\n' : '\n\\ No newline at end of file\n')
  );
}
