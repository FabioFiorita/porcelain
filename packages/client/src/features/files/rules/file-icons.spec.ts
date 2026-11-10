import { describe, expect, it } from 'vitest';
import { fileIconToken } from './file-icons.ts';

describe('Complete file icons', () => {
  it.each([
    ['src/main.ts', 'typescript'],
    ['src/view.tsx', 'react'],
    ['config.json', 'json'],
    ['notes.md', 'markdown'],
    ['package.json', 'json'],
    ['.gitignore', 'git'],
    ['unknown.mystery', 'default'],
    ['POSTCSS.config.ts', 'postcss'],
    ['article.mdx.tsx', 'markdown'],
    ['.env.local', 'text'],
    ['constructor', 'default'],
    ['src/__proto__', 'default'],
    ['notes.constructor', 'default'],
  ])('identifies %s as %s', (path, expected) => {
    expect(fileIconToken(path)).toBe(expected);
  });
});
