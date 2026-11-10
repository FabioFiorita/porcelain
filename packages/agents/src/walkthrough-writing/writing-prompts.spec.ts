import { expect, it } from 'vitest';
import type {
  WalkthroughJob,
  WalkthroughContent,
} from '@porcelain/walkthroughs/models';
import { answerPrompts, writingPrompts } from './writing-prompts.ts';

const job: WalkthroughJob = {
  run: {
    id: 'run',
    projectId: 'project',
    worktreeId: 'worktree',
    baseOid: 'a'.repeat(40),
    headOid: 'b'.repeat(40),
    baseRef: 'refs/heads/main',
    contentTreeOid: 'c'.repeat(40),
    includesUncommitted: true,
    writer: { provider: 'claude', model: 'fixture', effort: 'high' },
    createdAt: '2026-11-10T00:00:00Z',
    state: { status: 'queued' },
  },
  worktreePath: '/fixture',
  patch: '',
  files: [],
};
const content: WalkthroughContent = {
  outcome: 'nothing',
  title: 'A small change',
  summary: 'Changed.',
  growth: [],
  stops: [],
  onlyInTranscript: [],
  stillUnclear: [],
};
const prompts = (input: WalkthroughJob) => [
  writingPrompts(
    input,
    { title: '', body: '', checks: undefined, assets: [] },
    '',
    '',
  ).first,
  answerPrompts({ ...input, content, text: 'Why?', stopTitle: undefined })
    .fresh,
];

it('bounds inline UTF-8 patch bytes in writing and fresh answers and names omitted files', () => {
  const patch = Array.from(
    { length: 12 },
    (_, index) =>
      `diff --git a/file-${index} b/file-${index}\n@@ -0,0 +1 @@\n+${'é'.repeat(16000)}\n`,
  ).join('');
  for (const prompt of prompts({
    ...job,
    patch,
    omittedFiles: ['generated.txt'],
  })) {
    const inline =
      prompt.split('<captured_diff>\n')[1]?.split('</captured_diff>')[0] ?? '';
    expect(inline).toContain('diff --git a/file-0');
    expect(Buffer.byteLength(inline)).toBeLessThanOrEqual(128 * 1024);
    expect(inline).not.toContain('diff --git a/file-11');
    expect(prompt).toContain('generated.txt');
    expect(prompt).toContain('file-11');
    expect(prompt).toContain('read with the allowed commands if needed');
  }
});

it('reads committed changes through the immutable commit range without inlining their patch', () => {
  for (const prompt of prompts({
    ...job,
    run: { ...job.run, includesUncommitted: false },
    patch: 'never inline this clean patch',
  })) {
    expect(prompt).toContain(
      `git diff --no-ext-diff --no-textconv ${'a'.repeat(40)}..${'b'.repeat(40)}`,
    );
    expect(prompt).not.toContain('never inline this clean patch');
    expect(prompt).not.toContain('<captured_diff>');
  }
});
