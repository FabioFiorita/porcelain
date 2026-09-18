import { expect, it } from 'vitest';
import type { ReviewLayer } from '../../models/review-layers.ts';
import { selectLayers } from './commit-review-layer-association.ts';

it('does not promote a live-source guide into a partial commit snapshot', () => {
  const layer: ReviewLayer = {
    id: 'layer',
    title: 'Navigation',
    summary: 'Review the route boundary.',
    files: [
      { path: 'route.ts', scope: 'unstaged', note: 'Entry point' },
      { path: 'state.ts', scope: 'unstaged' },
    ],
    guide: {
      purpose: 'Understand transitions.',
      steps: [
        {
          id: 'step',
          title: 'Enter',
          question: 'Who owns navigation?',
          source: {
            path: 'state.ts',
            startLine: 1,
            endLine: 3,
            contentFingerprint: 'a'.repeat(64),
          },
        },
      ],
    },
  };
  const result = selectLayers(
    [layer],
    [{ path: 'route.ts', scope: 'unstaged' }],
  );
  expect(result).toEqual([
    {
      id: layer.id,
      title: layer.title,
      summary: layer.summary,
      files: [layer.files[0]],
    },
  ]);
  expect(layer.guide?.steps[0]?.source.path).toBe('state.ts');
  expect(layer.files).toHaveLength(2);
});
