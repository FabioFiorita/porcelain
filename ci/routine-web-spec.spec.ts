import { describe, expect, it } from 'vitest';
import { routineWebSpec } from './routine-web-spec.ts';

const modifiedSpec = {
  filename: 'apps/web/spec/e2e/projects-manual-selection.e2e.ts',
  status: 'modified',
};

describe('routine browser spec selection', () => {
  it('selects the existing spec as a file argument from the web workspace', () => {
    expect(routineWebSpec([modifiedSpec])).toBe(
      'spec/e2e/projects-manual-selection.e2e.ts',
    );
    expect(
      routineWebSpec([
        {
          ...modifiedSpec,
          filename: 'apps/web/spec/e2e/access-share.desktop.e2e.ts',
        },
      ]),
    ).toBe('spec/e2e/access-share.desktop.e2e.ts');
  });

  it.each(['added', 'removed', 'renamed', 'copied', 'changed'])(
    'leaves a %s spec in the full suite',
    (status) => {
      expect(routineWebSpec([{ ...modifiedSpec, status }])).toBeUndefined();
    },
  );

  it.each([
    'apps/web/spec/e2e/fixtures.ts',
    'apps/web/spec/e2e/nested/project.e2e.ts',
    'apps/web/spec/e2e/project.e2e.ts\n',
    'apps/web/src/projects.tsx',
    'package.json',
    '.github/workflows/ci.yml',
  ])(
    'leaves %s on the full path alone and alongside an eligible spec',
    (filename) => {
      const otherFile = { ...modifiedSpec, filename };
      expect(routineWebSpec([otherFile])).toBeUndefined();
      expect(routineWebSpec([modifiedSpec, otherFile])).toBeUndefined();
    },
  );
});
