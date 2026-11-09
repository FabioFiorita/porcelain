import type { FileDiffMetadata } from '@pierre/diffs';

export function fileChangeBars(diff: FileDiffMetadata | undefined): string {
  if (!diff) return '';
  return diff.hunks
    .flatMap((hunk) => {
      let line = hunk.additionStart;
      return hunk.hunkContent.flatMap((content) => {
        if (content.type === 'context') {
          line += content.lines;
          return [];
        }
        const start = line;
        line += content.additions;
        return Array.from(
          { length: content.additions },
          (_, index) =>
            `[data-code] [data-line="${start + index}"] { box-shadow: inset calc(var(--spacing) * 0.75) 0 var(--add-fg); }`,
        );
      });
    })
    .join('\n');
}
