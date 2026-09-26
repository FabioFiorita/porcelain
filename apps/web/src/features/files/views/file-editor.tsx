import { EditProvider, File } from '@pierre/diffs/react';
import { CheckIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import type { FileDraft, FileDraftState } from '@/features/files/store';
import { createPierreFileOptions } from '@/shared/lib/pierre';
import { useFileDraftSaving } from '@/features/files/commands/edit-file';
import { fileErrorMessage } from '../rules/error-message';
import {
  createEditor,
  usePierreFileEditor,
} from '../adapters/pierre-file-editor';
import { copyText } from '@/shared/workspace/copy';
import { usePreferences } from '@/shared/workspace/preferences';
import { useTheme } from '@/shared/workspace/theme';

function notifyUnsaved(path: string) {
  toast.add({
    title: `${path} was not saved`,
    description: 'Your draft is kept in this session. Reopen Edit to retry.',
    type: 'error',
  });
}

export function FileEditor({
  owner,
  path,
  draft,
  state,
  active,
  changed,
  onDone,
  onDiscard,
  renderToolbar,
}: {
  owner: string;
  path: string;
  draft: FileDraft;
  state: FileDraftState;
  active: boolean;
  changed: boolean;
  onDone: () => void;
  onDiscard: () => void;
  renderToolbar?: (controls: ReactNode) => ReactNode;
}) {
  const { preferences } = usePreferences();
  const { dark } = useTheme();
  const { file, options: editorOptions } = usePierreFileEditor(
    owner,
    path,
    state.text,
    draft,
    active,
    notifyUnsaved,
  );
  const dirty = state.text !== state.savedText;
  const { changedOnDisk, save, done } = useFileDraftSaving(draft, state);
  const label = changedOnDisk
    ? 'Not saving: changed on disk'
    : state.error
      ? 'Not saved'
      : state.saving
        ? 'Saving…'
        : dirty
          ? 'Unsaved changes'
          : state.text === file.contents
            ? 'Saves as you pause'
            : 'Saved';
  const controls = (
    <>
      <span role="status" className="text-xs text-muted-foreground">
        {label}
      </span>
      <Button
        size="sm"
        disabled={changedOnDisk}
        onClick={() => void done(onDone)}
      >
        <CheckIcon className="size-3.5" />
        Done
      </Button>
    </>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {renderToolbar?.(controls)}
      {changed && (
        <p className="border-b bg-graph-4/10 px-3.5 py-1.5 text-xs text-graph-4">
          Saving edits the changes you are reviewing.
        </p>
      )}
      {state.error != null && (
        <div
          role="alert"
          className="flex items-center gap-2 border-b px-3.5 py-2 text-xs text-destructive"
        >
          <span className="flex-1">
            {changedOnDisk
              ? 'The file changed on disk since you opened it. Reload it before saving.'
              : fileErrorMessage(state.error)}{' '}
            Your draft is kept here.
          </span>
          <Button
            size="xs"
            variant="outline"
            onClick={() => copyText(state.text, 'draft')}
          >
            Copy draft
          </Button>
          {!changedOnDisk && (
            <Button size="xs" variant="outline" onClick={() => void save()}>
              Retry save
            </Button>
          )}
          <Button size="xs" variant="ghost" onClick={onDiscard}>
            {changedOnDisk ? 'Reload' : 'Discard draft and reload'}
          </Button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        <EditProvider createEditor={createEditor}>
          <File
            file={file}
            edit
            editorOptions={editorOptions}
            options={createPierreFileOptions(dark ? 'dark' : 'light', {
              overflow: preferences.lineOverflow,
            })}
            onEditChange={(event) => draft.change(event.file.contents)}
            onEditComplete={() => 'reject'}
          />
        </EditProvider>
      </div>
    </div>
  );
}
