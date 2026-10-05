import { Effect } from 'effect';
import {
  Editor,
  type EditorFactory,
  type EditorOptions,
} from '@pierre/diffs/edit';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import type { FileDraftHandle } from '@porcelain/client/files';
import { editorFile, clearEditorFile } from '../store';

export const createEditor: EditorFactory<undefined, undefined> = (
  type,
  options,
  key,
) => new Editor(type, options, key);

export function usePierreFileEditor(
  owner: string,
  path: string,
  initialText: string,
  draft: FileDraftHandle,
  active: boolean,
  onUnsaved: (path: string) => void,
) {
  const session = editorFile(draft, owner, path, initialText);
  const { file, initialText: editorInitialText } = session;
  const latest = useRef(onUnsaved);
  useLayoutEffect(() => {
    latest.current = onUnsaved;
  });
  const options: EditorOptions<'file', undefined, undefined> = {
    onAttach(editor) {
      editor.focus({ lineNumber: 1, character: 0 });
    },
    onBlur() {
      if (!draft.state.value.error) void Effect.runPromise(draft.save());
    },
  };
  useHotkey(SHORTCUTS.saveFile, () => void Effect.runPromise(draft.save()), {
    enabled: active,
    ignoreInputs: false,
  });
  useEffect(() => {
    draft.attachEditor(owner);
    return () => {
      void Effect.runPromise(
        draft.finishEditing(
          owner,
          () => latest.current(path),
          () => clearEditorFile(draft, owner, session),
        ),
      );
    };
  }, [draft, owner, path]);
  return { file, initialText: editorInitialText, options };
}
