import { expect, it } from 'vite-plus/test';
import { tabHref, tabRootPath } from './tab-href';

it('a tab root names its own tab group, so it never opens inside another tab', () => {
  expect(tabHref('files')).toBe('/(tabs)/(files)/files');
});

it.each([
  { path: '/files', target: '/(tabs)/(files)/files' },
  {
    path: 'porcelain.dev://history?x=1',
    target: '/(tabs)/(history)/history?x=1',
  },
  { path: '/file?path=README.md', target: '/file?path=README.md' },
  { path: '/settings', target: '/settings' },
  { path: '/open/pair?link=abc', target: '/open/pair?link=abc' },
])('$path opens $target', ({ path, target }) => {
  expect(tabRootPath(path)).toBe(target);
});
