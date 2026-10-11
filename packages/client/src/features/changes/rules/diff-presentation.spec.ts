import { expect, it } from 'vitest';
import {
  diffUnavailableReason,
  omissionReason,
  patchUnavailable,
} from './diff-presentation.ts';

const file = { oldMode: '100644', newMode: '100644' };
const text = { kind: 'text', patch: '@@ -1 +1 @@\n-before\n+after' } as const;

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
  [text, undefined],
] as const)('labels %j without inventing a preview', (content, label) => {
  expect(patchUnavailable(content)).toBe(label);
});

it('names a submodule on either side before its patch is read or even when it reads as text', () => {
  expect([
    diffUnavailableReason({ ...file, oldMode: '160000' }, undefined, false),
    diffUnavailableReason({ ...file, newMode: '160000' }, text, false),
    diffUnavailableReason({ ...file, newMode: '160000' }, undefined, true),
  ]).toEqual(['Submodule change', 'Submodule change', 'Submodule change']);
});

it('tells a patch still being read from one that failed', () => {
  expect([
    diffUnavailableReason(file, undefined, false),
    diffUnavailableReason(file, undefined, true),
  ]).toEqual(['Reading the patch', 'The patch could not be read']);
});

it('falls back to the patch label once the patch has arrived and leaves text previewable', () => {
  expect([
    diffUnavailableReason(file, { kind: 'binary' }, true),
    diffUnavailableReason(
      file,
      { kind: 'omitted', reason: 'size-limit' },
      false,
    ),
    diffUnavailableReason(file, text, false),
  ]).toEqual(['Binary change', 'Too large to show', undefined]);
});

it('names every reason the server omits a patch', () => {
  expect(
    (
      ['size-limit', 'unsupported-submodule', 'unsupported-encoding'] as const
    ).map(omissionReason),
  ).toEqual([
    'Too large to show',
    'Submodule change',
    'Unsupported text encoding',
  ]);
});
