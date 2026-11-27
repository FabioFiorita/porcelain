import { expect, it } from 'vite-plus/test';
import { markdownOutline, topHeadingLevel } from './markdown-outline.ts';

const many = Array.from({ length: 160_000 }, (_, index) => ({
  level: [3, 4, 5][index % 3] ?? 3,
}));

it('outlines a titled document below its title with two levels', () => {
  const headings = [1, 2, 3, 2, 4].map((level, index) => ({
    level,
    id: `h${index}`,
  }));
  expect(markdownOutline(headings).map((heading) => heading.id)).toEqual([
    'h1',
    'h2',
    'h3',
  ]);
});

it('finds the top heading level of a document with 160,000 headings', () => {
  expect(topHeadingLevel(many)).toBe(3);
});

it('outlines a document with 160,000 headings with its top two levels', () => {
  const outline = markdownOutline(many);
  expect(outline).toHaveLength(106_667);
  expect(new Set(outline.map((heading) => heading.level))).toEqual(
    new Set([3, 4]),
  );
});
