import { expect, test } from 'vitest';
import { scheduledRegistry } from '../../../spec/kit/atom-registry';
import { documentReadingLine, documentReadingStart } from './document-reading';

test('reading lines survive unmount and remain scoped to workspace and document', () => {
  const { registry, flush } = scheduledRegistry();
  try {
    const atom = documentReadingLine({
      workspace: 'first',
      document: 'file:docs/long.ts',
    });
    const leave = registry.mount(atom);
    registry.set(atom, 350);
    leave();
    flush();
    expect(
      registry.get(
        documentReadingLine({
          workspace: 'first',
          document: 'file:docs/long.ts',
        }),
      ),
    ).toBe(350);
    expect(
      registry.get(
        documentReadingLine({
          workspace: 'second',
          document: 'file:docs/long.ts',
        }),
      ),
    ).toBe(1);
    expect(
      registry.get(
        documentReadingLine({ workspace: 'first', document: 'file:other.ts' }),
      ),
    ).toBe(1);
    expect(
      registry.get(
        documentReadingLine({
          workspace: 'first',
          document: 'branch:checkpoint:docs/long.ts',
        }),
      ),
    ).toBe(1);
  } finally {
    registry.dispose();
  }
});

test('replacing live source starts at the latest reading line without subscribing the reader to scrolling', () => {
  const { registry } = scheduledRegistry();
  const input = { workspace: 'first', document: 'file:docs/long.ts' };
  const start = documentReadingStart({ ...input, version: 'Original source' });
  const changes: number[] = [];
  const stop = registry.subscribe(start, (line) => changes.push(line), {
    immediate: true,
  });
  try {
    registry.set(documentReadingLine(input), 350);
    expect(changes).toEqual([1]);
    expect(
      registry.get(
        documentReadingStart({ ...input, version: 'Updated source' }),
      ),
    ).toBe(350);
  } finally {
    stop();
    registry.dispose();
  }
});
