import { describe, expect, it } from 'vitest';
import { reviewFixture } from '../api/review/fixtures';
import { artifactKind, changePath, groupChanges } from './review';

it('uses layer/file order and keeps unassigned and stale metadata from hiding real changes', () => {
  const { status, layers } = reviewFixture(
    '801a8628-1cd6-4562-81a2-9c05fba76b4a',
    '7fe18f78-1477-4c19-a42b-cdd42f862151',
    'refs/heads/main',
  );
  layers.layers[0]?.files.unshift({ path: 'missing.ts', scope: 'staged' });
  const groups = groupChanges(status, layers);
  expect(groups.map((group) => group.title)).toEqual([
    'A clearer review experience',
    'Refine the foundation',
    'Unassigned',
  ]);
  expect(groups[1]?.changes.map(changePath)).toEqual([
    'src/domain/review.ts',
    'src/styles/theme.css',
  ]);
  expect(groups.flatMap((group) => group.changes)).toHaveLength(
    status.changes.length,
  );
});

describe('artifact format selection', () => {
  it('uses extensions and recognizable content when artifact names are titles', () => {
    expect(artifactKind('notes.md', 'plain')).toBe('markdown');
    expect(artifactKind('Launch report', '<!doctype html><html />')).toBe(
      'html',
    );
    expect(artifactKind('Keyboard audit', '# Keyboard audit')).toBe('markdown');
    expect(artifactKind('Design study', 'Ordinary notes')).toBe('text');
  });
});
