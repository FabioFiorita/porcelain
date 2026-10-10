import { expect, it } from 'vitest';
import { patchUnavailable } from './diff-presentation.ts';
it.each([
  [{ kind: 'binary' }, 'Binary change'],
  [
    { kind: 'metadata-only', patch: 'old mode 100644\nnew mode 100755' },
    'No code change',
  ],
  [{ kind: 'omitted', reason: 'size-limit' }, 'Too large to show'],
  [
    { kind: 'omitted', reason: 'unsupported-encoding' },
    'Unsupported text encoding',
  ],
  [{ kind: 'omitted', reason: 'unsupported-submodule' }, 'Submodule change'],
  [{ kind: 'text', patch: '@@ -1 +1 @@\n-before\n+after' }, undefined],
] as const)('labels %j without inventing a preview', (content, label) => {
  expect(patchUnavailable(content)).toBe(label);
});
