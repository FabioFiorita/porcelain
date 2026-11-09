import { expect, it } from 'vitest';
import { documentHeading } from './document-heading.ts';

it('titles a document by its file name and names its folder and status beneath', () => {
  expect(documentHeading('apps/mobile/src/ui/button.tsx', ['added'])).toEqual({
    title: 'button.tsx',
    subtitle: 'apps/mobile/src/ui · added',
  });
  expect(
    documentHeading('src/review.ts', ['staged · unstaged', 'Reviewed']),
  ).toEqual({
    title: 'review.ts',
    subtitle: 'src · staged · unstaged · Reviewed',
  });
});

it('leaves the second line out when a root file has no status', () => {
  expect(documentHeading('README.md')).toEqual({
    title: 'README.md',
    subtitle: undefined,
  });
  expect(documentHeading('README.md', [undefined, 'Reviewed'])).toEqual({
    title: 'README.md',
    subtitle: 'Reviewed',
  });
});
