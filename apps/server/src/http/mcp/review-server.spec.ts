import { expect, it } from 'vitest';
import { summaryStyleWarning } from './review-server.ts';

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
