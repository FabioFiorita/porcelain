import {
  Editor,
  type EditorFactory,
  type EditorOptions,
} from '@pierre/diffs/edit';
import { EditProvider, File } from '@pierre/diffs/react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { CheckIcon } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import type { FileDraft, FileDraftState } from '../../domain/file-draft';
import { PIERRE_SURFACE_CSS, PIERRE_THEME } from '../../lib/pierre';
import { reviewErrorMessage } from '../../query/review';
import { copyText } from '../workspace/copy';
import { usePreferences } from '../workspace/preferences';
import { SHORTCUTS } from '../workspace/shortcuts';
import { useTheme } from '../workspace/theme';

const createEditor: EditorFactory<undefined, undefined> = (
  type,
  options,
  key,
) => new Editor(type, options, key);
export function FileEditor({
  owner,
  path,
  draft,
  state,
  active,
  changed,
  onDone,
  onDiscard,
  toolbar,
}: {
  owner: string;
  path: string;
  draft: FileDraft;
  state: FileDraftState;
  active: boolean;
  changed: boolean;
  onDone: () => void;
  onDiscard: () => void;
  toolbar: (controls: ReactNode) => ReactNode;
}) {
  const { preferences } = usePreferences();
  const { dark } = useTheme();
  const [file] = useState(() => ({ name: path, contents: state.text }));
  const dirty = state.text !== state.savedText;
  const save = () => void draft.save();
  useHotkey(SHORTCUTS.saveFile, save, { enabled: active, ignoreInputs: false });
  useEffect(() => {
    if (state.text === state.savedText || state.error || state.saving) return;
    const timer = setTimeout(() => void draft.save(), 3000);
    return () => clearTimeout(timer);
  }, [draft, state.text, state.savedText, state.error, state.saving]);
  useEffect(() => {
    return () => {
      draft.release(owner);
      if (!draft.snapshot().error)
        void draft.save().then((saved) => {
          if (!saved)
            toast.add({
              title: `${path} was not saved`,
              description:
                'Your draft is kept in this session. Reopen Edit to retry.',
              type: 'error',
            });
        });
    };
  }, [draft, path, owner]);
  const editorOptions = useMemo<EditorOptions<'file', undefined, undefined>>(
    () => ({
      onAttach(editor) {
        editor.focus({ lineNumber: 1, character: 0 });
      },
      onBlur() {
        if (!draft.snapshot().error) void draft.save();
      },
    }),
    [draft],
  );
  const label = state.error
    ? 'Not saved'
    : state.saving
      ? 'Saving…'
      : dirty
        ? 'Unsaved changes'
        : state.text === file.contents
          ? 'Saves as you pause'
          : 'Saved';
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {toolbar(
        <>
          <span role="status" className="text-xs text-muted-foreground">
            {label}
          </span>
          <Button
            size="sm"
            onClick={() =>
              void draft.save().then((saved) => {
                if (saved) onDone();
              })
            }
          >
            <CheckIcon className="size-3.5" />
            Done
          </Button>
        </>,
      )}
      {changed && (
        <p className="border-b bg-amber-500/10 px-3.5 py-1.5 text-xs text-amber-800 dark:text-amber-200">
          Saving edits the changes you are reviewing.
        </p>
      )}
      {state.error != null && (
        <div
          role="alert"
          className="flex items-center gap-2 border-b px-3.5 py-2 text-xs text-destructive"
        >
          <span className="flex-1">
            {reviewErrorMessage(state.error)} Your draft is kept here.
          </span>
          <Button
            size="xs"
            variant="outline"
            onClick={() => copyText(state.text, 'draft')}
          >
            Copy draft
          </Button>
          <Button size="xs" variant="outline" onClick={save}>
            Retry save
          </Button>
          <Button size="xs" variant="ghost" onClick={onDiscard}>
            Discard draft and reload
          </Button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        <EditProvider createEditor={createEditor}>
          <File
            file={file}
            edit
            editorOptions={editorOptions}
            options={{
              theme: PIERRE_THEME,
              themeType: dark ? 'dark' : 'light',
              overflow: preferences.lineOverflow,
              disableFileHeader: true,
              unsafeCSS: `${PIERRE_SURFACE_CSS}[data-code] { padding-top: 0 !important; }`,
            }}
            onEditChange={(event) => draft.change(event.file.contents)}
            onEditComplete={() => 'reject'}
          />
        </EditProvider>
      </div>
    </div>
  );
}
