import { describe, expect, it } from 'vitest';
import { groupSpecPaths, isSpecPath } from './spec-paths.ts';

describe('isSpecPath', () => {
  it.each([
    { path: 'src/search.spec.ts', spec: true },
    { path: 'src/search.test.tsx', spec: true },
    { path: 'src/search.browser.ts', spec: true },
    { path: 'spec/notes.md', spec: true },
    { path: 'docs/specs/guide.md', spec: true },
    { path: 'src/__tests__/search.ts', spec: true },
    { path: 'src/tests/search.ts', spec: true },
    { path: 'pkg/search_test.go', spec: true },
    { path: 'app/search_spec.rb', spec: true },
    { path: 'tests_suite/test_search.py', spec: true },
    { path: 'src/main/SearchTest.java', spec: true },
    { path: 'Sources/SearchTests.swift', spec: true },
    { path: 'src/contest.ts', spec: false },
    { path: 'src/Testimony.java', spec: false },
    { path: 'src/search.ts', spec: false },
    { path: 'src/latest.ts', spec: false },
    { path: 'src/spec.ts', spec: false },
  ])('treats $path as a spec file when that is $spec', ({ path, spec }) => {
    expect(isSpecPath(path)).toBe(spec);
  });
});

describe('groupSpecPaths', () => {
  const entries = [
    { path: 'src/search.spec.ts' },
    { path: 'src/search.ts' },
    { path: 'src/tests/empty.ts' },
    { path: 'README.md' },
  ];

  it('keeps the original order until grouping is on', () => {
    expect(groupSpecPaths(entries, false)).toBe(entries);
  });

  it('places spec files after the other files', () => {
    expect(groupSpecPaths(entries, true).map((entry) => entry.path)).toEqual([
      'src/search.ts',
      'README.md',
      'src/search.spec.ts',
      'src/tests/empty.ts',
    ]);
  });
});
