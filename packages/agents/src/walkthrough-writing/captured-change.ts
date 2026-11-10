import type { WalkthroughRun } from '@porcelain/walkthroughs/models';

const INLINE_DIFF_BYTES = 128 * 1024;
const encoder = new TextEncoder();

export function capturedChange(input: {
  run: WalkthroughRun;
  patch: string;
  omittedFiles?: readonly string[] | undefined;
}) {
  const range = `${input.run.baseOid}..${input.run.headOid}`;
  const omitted = [...(input.omittedFiles ?? [])];
  const inline: string[] = [];
  let bytes = 0;
  if (input.run.includesUncommitted)
    for (const section of input.patch.split(/(?=^diff --git )/m)) {
      const size = encoder.encode(section).byteLength;
      if (bytes + size <= INLINE_DIFF_BYTES) {
        inline.push(section);
        bytes += size;
      } else omitted.push(section.split('\n', 1)[0] ?? 'remaining patch');
    }
  const skipped =
    omitted.length === 0
      ? ''
      : `
<omitted_diff>
Too large to include, or omitted by inspection; read with the allowed commands if needed:
${[...new Set(omitted)].map((path) => `- ${JSON.stringify(path)}`).join('\n')}
Omitted files cannot supply excerpts; name them under files instead.
</omitted_diff>`;
  if (!input.run.includesUncommitted)
    return `The change is the immutable commit range ${range}. Only this range belongs to it. Read it with git diff --no-ext-diff --no-textconv ${range}; use git show ${input.run.baseOid}:<path> for the old side. Never write files or Git metadata.${skipped}`;
  return `The change is the base commit ${input.run.baseOid} to the captured working state ${input.run.contentTreeOid}, including committed, staged, unstaged and untracked non-ignored files. The head when captured was ${input.run.headOid} with uncommitted work. The bounded captured diff below is authoritative for included sections; later working files may differ. Read surrounding code with Read, Grep or Glob; use git show ${input.run.baseOid}:<path> for the old side. Read-only git diff --no-ext-diff --no-textconv ${input.run.baseOid} -- <path> shows current tracked work, and git diff --no-ext-diff --no-textconv --no-index /dev/null <path> shows a current untracked addition. These fallback commands show current content, not the saved snapshot; do not claim it was captured if it differs. Never write files or Git metadata.
<captured_diff>
${inline.join('')}</captured_diff>${skipped}`;
}
