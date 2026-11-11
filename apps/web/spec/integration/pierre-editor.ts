import { VirtualizedFile, Virtualizer } from '@pierre/diffs';
import { Editor } from '@pierre/diffs/edit';
import { vi } from 'vitest';
import { createPierreFileOptions } from '@/shared/lib/pierre';

export function createPierreEditor() {
  const host = document.createElement('div');
  const content = document.createElement('div');
  host.style.height = '240px';
  host.style.overflow = 'auto';
  host.append(content);
  document.body.append(host);
  const virtualizer = new Virtualizer();
  virtualizer.setup(host, content);
  const file = new VirtualizedFile(
    createPierreFileOptions('light'),
    virtualizer,
  );
  file.render({
    file: { name: 'input.txt', lang: 'text', contents: '' },
    containerWrapper: content,
  });
  const attached = Promise.withResolvers<void>();
  const editor = new Editor('file', {
    onAttach: () => attached.resolve(),
  });
  const inputs: string[] = [];
  const record = (event: Event) => {
    const target = event.composedPath()[0];
    if (
      target instanceof HTMLElement &&
      target.getAttribute('role') === 'textbox'
    )
      inputs.push(target.textContent ?? '');
  };
  host.addEventListener('beforeinput', record);
  editor.edit(file);
  let restoreClock: () => void = () => undefined;
  return {
    ready: () => attached.promise,
    exhaustHighlightBudget() {
      vi.useFakeTimers({ toFake: ['performance'] });
      let elapsed = 0;
      const clock = vi.spyOn(performance, 'now').mockImplementation(() => {
        elapsed += 2;
        return elapsed;
      });
      restoreClock = () => {
        clock.mockRestore();
        vi.useRealTimers();
      };
    },
    inputs: () => [...inputs],
    dispose() {
      restoreClock();
      host.removeEventListener('beforeinput', record);
      editor.cleanUp('discard');
      file.cleanUp();
      virtualizer.cleanUp();
      host.remove();
    },
  };
}
