import {
  Editor,
  type EditorFactory,
  type EditorOptions,
} from '@pierre/diffs/edit';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
type EditorDraft = {
  snapshot: () => { error: unknown };
  save: () => Promise<boolean>;
  editorFile: (
    owner: string,
    path: string,
    text: string,
  ) => {
    file: { name: string; contents: string };
    initialText: string;
  };
  attachEditor: (owner: string) => void;
  finishEditing: (owner: string, onUnsaved: () => void) => void;
};

export const createEditor: EditorFactory<undefined, undefined> = (
  type,
  options,
  key,
) => new Editor(type, options, key);

export function usePierreFileEditor(
  owner: string,
  path: string,
  initialText: string,
  draft: EditorDraft,
  active: boolean,
  onUnsaved: (path: string) => void,
) {
  const { file, initialText: editorInitialText } = draft.editorFile(
    owner,
    path,
    initialText,
  );
  const latest = useRef(onUnsaved);
  useLayoutEffect(() => {
    latest.current = onUnsaved;
  });
  const options: EditorOptions<'file', undefined, undefined> = {
    onAttach(editor) {
      editor.focus({ lineNumber: 1, character: 0 });
    },
    onBlur() {
      if (!draft.snapshot().error) void draft.save();
    },
  };
  useHotkey(SHORTCUTS.saveFile, () => void draft.save(), {
    enabled: active,
    ignoreInputs: false,
  });
  useEffect(() => {
    draft.attachEditor(owner);
    return () => draft.finishEditing(owner, () => latest.current(path));
  }, [draft, owner, path]);
  return { file, initialText: editorInitialText, options };
}
