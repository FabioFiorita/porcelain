import { Effect } from 'effect';
import { Virtualizer, VirtualizedFile } from '@pierre/diffs';
import { Editor } from '@pierre/diffs/edit';
import { useAtomValue } from '@effect/atom-react';
import type { FileDraftHandle } from '@porcelain/client/files';
import {
  preferenceValues,
  resolvedAppearance,
} from '@/features/preferences/index';
import { createPierreFileOptions } from '@/shared/lib/pierre';
import { atomRegistry } from '@/shared/store';
import { editorFile, clearEditorFile } from '../store';

export function usePierreFileEditor(
  owner: string,
  path: string,
  initialText: string,
  draft: FileDraftHandle,
  onUnsaved: (path: string) => void,
) {
  const session = editorFile(draft, owner, path, initialText);
  const registry = useAtomValue(atomRegistry);
  function attach(host: HTMLDivElement | null) {
    if (!host) return;
    const content = document.createElement('div');
    host.append(content);
    const virtualizer = new Virtualizer();
    virtualizer.setup(host, content);
    const options = () => ({
      ...createPierreFileOptions(registry.get(resolvedAppearance), {
        overflow: registry.get(preferenceValues).lineOverflow,
      }),
      onEditChange: (event: { file: { contents: string } }) => {
        Effect.runFork(draft.change(event.file.contents));
      },
      onEditComplete: () => 'reject' as const,
    });
    const file = new VirtualizedFile(options(), virtualizer);
    file.render({ file: session.file, containerWrapper: content });
    const editor = new Editor('file', {
      onAttach(editor) {
        if (!host.matches(':focus-within'))
          editor.focus({ lineNumber: 1, character: 0 });
      },
      onBlur() {
        if (!draft.state.value.error) Effect.runFork(draft.save());
      },
    });
    draft.attachEditor(owner);
    editor.edit(file);
    const update = () => {
      file.setOptions(options());
      file.rerender();
    };
    const unsubscribePreferences = registry.subscribe(preferenceValues, update);
    const unsubscribeTheme = registry.subscribe(resolvedAppearance, update);
    const unsubscribeDraft = draft.state.subscribe((state) => {
      if (state.text !== state.savedText || state.text === editor.getText())
        return;
      session.file = { name: path, contents: state.text };
      session.initialText = state.text;
      file.render({ file: session.file, containerWrapper: content });
    });
    return () => {
      unsubscribePreferences();
      unsubscribeTheme();
      unsubscribeDraft();
      editor.cleanUp('discard');
      file.cleanUp();
      virtualizer.cleanUp();
      content.remove();
      Effect.runFork(
        draft.finishEditing(
          owner,
          () => onUnsaved(path),
          () => clearEditorFile(draft, owner, session),
        ),
      );
    };
  }
  return { initialText: session.initialText, attach };
}
