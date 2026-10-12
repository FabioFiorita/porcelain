import { CodeView, type CodeViewItem } from '@pierre/diffs';
import { expect, vi, type MockInstance } from 'vitest';

type DisposableInstance = { cleanUp: (recycle?: boolean) => void };
type CleanupSpy = MockInstance<(recycle?: boolean) => void>;

export function createPierreCodeView() {
  const element = document.createElement('div');
  element.style.height = '240px';
  element.style.overflow = 'auto';
  document.body.append(element);
  const items: CodeViewItem<undefined>[] = ['discarded', 'retained'].map(
    (id) => ({
      id,
      type: 'file',
      edit: false,
      file: {
        name: `${id}.txt`,
        lang: 'text',
        contents: Array.from(
          { length: 200 },
          (_, index) => `${id} line ${index + 1}`,
        ).join('\n'),
      },
    }),
  );
  const viewer = new CodeView();
  const spies: CleanupSpy[] = [];
  const captured = new Set<DisposableInstance>();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    try {
      for (const spy of spies) spy.mockRestore();
      viewer.cleanUp();
    } finally {
      try {
        for (const instance of captured) instance.cleanUp();
      } finally {
        element.remove();
      }
    }
  };
  try {
    viewer.setup(element);
    viewer.setItems(items);
    viewer.render(true);
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    async observeRecycled() {
      await expect
        .poll(() => viewer.getRenderedItems().map((item) => item.id))
        .toEqual(['discarded']);
      const discarded = viewer.getRenderedItems()[0];
      if (!discarded || discarded.type !== 'file')
        throw new Error('The real discarded file must render before capture.');
      captured.add(discarded.instance);
      const discardedSpy = vi.spyOn(discarded.instance, 'cleanUp');
      spies.push(discardedSpy);
      viewer.scrollTo({
        type: 'line',
        id: 'retained',
        lineNumber: 150,
        align: 'start',
        behavior: 'instant',
      });
      viewer.render(true);
      await expect
        .poll(() => viewer.getRenderedItems().map((item) => item.id))
        .toEqual(['retained']);
      const retained = viewer.getRenderedItems()[0];
      if (!retained || retained.type !== 'file')
        throw new Error('The real retained file must render after scrolling.');
      captured.add(retained.instance);
      const retainedSpy = vi.spyOn(retained.instance, 'cleanUp');
      spies.push(retainedSpy);
      return {
        discardedIsRendered: () =>
          viewer
            .getRenderedItems()
            .some((item) => item.instance === discarded.instance),
        retainedIsRendered: () =>
          viewer
            .getRenderedItems()
            .some((item) => item.instance === retained.instance),
        discardedCleanups: () =>
          discardedSpy.mock.calls.map(([recycle]) =>
            recycle === true ? 'recycle' : 'dispose',
          ),
        retainedCleanups: () =>
          retainedSpy.mock.calls.map(([recycle]) =>
            recycle === true ? 'recycle' : 'dispose',
          ),
        clear() {
          discardedSpy.mockClear();
          retainedSpy.mockClear();
        },
      };
    },
    reset: () => viewer.reset(),
    removeDiscarded: () =>
      viewer.setItems(items.filter((item) => item.id === 'retained')),
    renderedIds: () => viewer.getRenderedItems().map((item) => item.id),
    dispose,
  };
}
