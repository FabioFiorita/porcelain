import { expect, it } from 'vitest';
import { importMap } from './import-map';
it('keeps shared owners in every annotated decision slice, including direct neighbours only', () => {
  const owners = ['a', 'b', 'c', 'd'].map((path) => ({
    path,
    files: [],
    annotations: [],
    layerIds: path === 'a' ? ['first', 'second'] : [],
  }));
  const map = importMap(
    {
      kind: 'imports',
      owners,
      edges: [
        { from: 'b', to: 'a' },
        { from: 'a', to: 'c' },
        { from: 'c', to: 'd' },
      ],
      guards: [],
      unresolved: 0,
    },
    'second',
  );
  expect(map.boxes.map((box) => box.id)).toEqual(['a', 'b', 'c']);
  expect(map.boxes[0]?.layerId).toBe('second');
  expect(map.arrows).toEqual([
    { from: 'b', to: 'a', label: 'imports' },
    { from: 'a', to: 'c', label: 'imports' },
  ]);
});
