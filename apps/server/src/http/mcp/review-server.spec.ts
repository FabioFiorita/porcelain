import { expect, it } from 'vitest';
import { REVIEW_GUIDE } from './review-guide.ts';
import { commentsForAgent, summaryStyleWarning } from './review-server.ts';

const thread = (
  author: 'reviewer' | 'agent',
  resolved = false,
  earlier?: 'reviewer' | 'agent',
) => ({
  resolved,
  messages: [...(earlier ? [{ author: earlier }] : []), { author }],
});

it('lists comments waiting for the agent unless the caller asks for all', () => {
  const waiting = thread('reviewer');
  const answered = thread('agent', false, 'reviewer');
  const startedByAgent = thread('agent');
  const resolved = thread('reviewer', true);
  const empty = { resolved: false, messages: [] };

  expect(
    commentsForAgent([waiting, answered, startedByAgent, resolved, empty]),
  ).toEqual([waiting, empty]);
  expect(
    commentsForAgent([waiting, answered, startedByAgent, resolved], 'all').map(
      (item) => item.resolved,
    ),
  ).toEqual([false, false, false, true]);
});

it('tells the agent how to design, diagram, repair gaps, and read comments', () => {
  expect(REVIEW_GUIDE).toContain('## Summary');
  expect(REVIEW_GUIDE).toContain('--porcelain-background');
  expect(REVIEW_GUIDE).toContain('## Diagram');
  expect(REVIEW_GUIDE).toContain(
    '## Repair gaps before handing the review off',
  );
  expect(REVIEW_GUIDE).toContain('scope: "waiting"');
  expect(REVIEW_GUIDE).toContain('scope: "all"');
  expect(REVIEW_GUIDE).toContain('reply_to_comment');
});

it.each([
  '<h1>Summary</h1>',
  '<style> </style><h1>Summary</h1>',
  '<style>/* design later */</style>',
  '<!-- <style>body { color: red }</style> -->',
  '<script>const example = "<style>body { color: red }</style>";</script>',
  '<main style="">Summary</main>',
  '<link rel="preconnect" href="https://example.test">',
])('warns when CSS is absent: %s', (html) => {
  expect(summaryStyleWarning(html)).toContain('No authored CSS was detected');
});

it.each([
  '<style>body { color: red }</style>',
  '<STYLE media="screen">body { color: red }</STYLE>',
  '<main style="color: red">Summary</main>',
  "<main style='color: red'>Summary</main>",
  '<main style=color:red>Summary</main>',
  '<link href="https://example.test/review.css" rel="stylesheet">',
  "<link rel='alternate stylesheet' href='review.css'>",
  '<link rel=stylesheet href=review.css>',
])('recognizes authored styles without judging their quality: %s', (html) => {
  expect(summaryStyleWarning(html)).toBeUndefined();
});
