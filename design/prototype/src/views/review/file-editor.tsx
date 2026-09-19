import type { FileContents } from '@pierre/diffs';
import {
  Editor,
  type EditorFactory,
  type EditorOptions,
} from '@pierre/diffs/edit';
import { EditProvider, File } from '@pierre/diffs/react';
import { useHotkey } from '@tanstack/react-hotkeys';
import {
  Check,
  Copy,
  PencilLine,
  RotateCcw,
  Save,
  TriangleAlert,
} from 'lucide-react';
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { basename, type ReviewScope } from '../../domain/review';
import { isFileChanged, useTextFile, useWriteFile } from '../../query/files';
import { reviewErrorMessage } from '../../query/review';
import { copyText } from '../workspace/copy';
import { notifySuccess } from '../workspace/notify';
import { usePreferences } from '../workspace/preferences';
import { SHORTCUTS } from '../workspace/shortcuts';
import { type EditDraft, editDrafts, useEditDraft } from './edit-drafts';
import { FLUSH_TOP_CSS, PIERRE_THEME, SURFACE_CSS } from './pierre';

/** Long enough to pause mid-thought without writing a half-typed value. */
const IDLE_SAVE_MS = 3000;

const createEditor: EditorFactory<undefined, undefined> = (
  type,
  options,
  editStateKey,
) => new Editor(type, options, editStateKey);

type Status = 'clean' | 'unsaved' | 'saving' | 'saved' | 'conflict' | 'failed';

/** How a draft left behind reopens. */
const DRAFT_STATUS: Record<EditDraft['state'], Status> = {
  saving: 'unsaved',
  conflict: 'conflict',
  failed: 'failed',
};

const STATUS_LABEL: Record<Status, string> = {
  clean: 'Saves as you pause',
  unsaved: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  conflict: 'Not saving: changed on disk',
  failed: 'Not saved',
};

type Props = {
  scope: ReviewScope;
  path: string;
  /** The text the reader showed; the editor opens on the cached read of the same file, with its fingerprint. */
  text: string;
  /** The file is part of the agent's changes, so a save edits what is under review. */
  partOfChanges: boolean;
  /** Only the focused pane answers ⌘S. */
  active: boolean;
  onDone: () => void;
  /** The file document's own toolbar, given the save status and Done. */
  renderToolbar: (controls: ReactNode) => ReactNode;
};

/**
 * Quick edits in place (a `.env`, a typo), not an IDE. Saves three seconds after
 * the last keystroke, when the editor loses focus, when the tab closes, and on
 * ⌘S. Every save carries the server's fingerprint of what was last read or
 * written (`TextResponse.fingerprint`), so a file the agent changed meanwhile is
 * never overwritten: autosave pauses and the reviewer picks a way out. An edit that
 * has not landed when the editor closes is kept (`edit-drafts.ts`) and reopens here.
 */
export function FileEditor({
  scope,
  path,
  text,
  partOfChanges,
  active,
  onDone,
  renderToolbar,
}: Props) {
  const { preferences, resolvedTheme } = usePreferences();
  const write = useWriteFile(scope);
  const editorRef = useRef<Editor<'file', undefined, undefined> | null>(null);
  // The same read the reader showed (a cache hit), kept current by the live channel.
  // The editor keeps what it opened on: a reload of the file under it must not move
  // the fingerprint its saves send.
  const read = useTextFile(scope, path);
  const [opened] = useState(() => {
    const draft = editDrafts.get(scope.worktreeId, path);
    if (draft != null)
      return { text: draft.text, base: draft.base, state: draft.state };
    const base =
      read.kind === 'text'
        ? { text: read.text, fingerprint: read.fingerprint }
        : { text, fingerprint: '' };
    return { text: base.text, base, state: null };
  });
  const [status, setStatus] = useState<Status>(
    opened.state == null ? 'clean' : DRAFT_STATUS[opened.state],
  );
  /** The fingerprint the server refused; Retry waits for a read newer than it. */
  const [refused, setRefused] = useState(
    opened.state === 'conflict' ? opened.base.fingerprint : null,
  );
  const file = useMemo<FileContents>(
    () => ({ name: path, contents: opened.text }),
    [path, opened],
  );

  // Refs, because saves also run from timers, blur and unmount, outside any render.
  const lastSaved = useRef(opened.base);
  /**
   * The document as of the last change event. Saves read this, never the editor:
   * when the editor closes, Pierre resets it to the original text, and reading it
   * then would write the original back over everything already saved.
   */
  const latestText = useRef(opened.text);
  /** The save on its way, including any follow-up it queued; null when idle. */
  const inFlight = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  /** Changed on disk: nothing saves until the reviewer chooses Retry. */
  const paused = useRef(opened.state === 'conflict');
  /** The editor closed; a save still on its way reports to the draft store instead. */
  const left = useRef(false);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submit = useRef(write.submit);
  useLayoutEffect(() => {
    submit.current = write.submit;
  });

  const clearIdle = () => {
    if (idle.current != null) clearTimeout(idle.current);
    idle.current = null;
  };

  /**
   * Writes the editor's text if it differs from what was last saved. While a save
   * is on its way, returns that one (plus the follow-up it will run), so Done never
   * leaves before the text has landed: clicking Done blurs the editor, which starts
   * a save first.
   */
  const save = (
    reason: 'idle' | 'blur' | 'leave' | 'shortcut' | 'retry',
  ): Promise<void> => {
    clearIdle();
    const next = latestText.current;
    if (inFlight.current != null) {
      again.current = true;
      return inFlight.current;
    }
    if (next === lastSaved.current.text) return Promise.resolve();
    if (paused.current && reason !== 'retry') return Promise.resolve();
    if (!left.current) setStatus('saving');
    const request = submit
      .current({
        path,
        text: next,
        expectedFingerprint: lastSaved.current.fingerprint,
      })
      .then(
        (saved) => {
          lastSaved.current = { text: next, fingerprint: saved.fingerprint };
          paused.current = false;
          inFlight.current = null;
          if (again.current) {
            again.current = false;
            // Typed on while this one ran: save that too. Otherwise this save was the last.
            if (latestText.current !== next) return save(reason);
          }
          if (!left.current) {
            setStatus(latestText.current === next ? 'saved' : 'unsaved');
          } else if (latestText.current === next) {
            editDrafts.remove(scope.worktreeId, path);
            notifySuccess(`Saved ${basename(path)}`);
          }
        },
        (error: unknown) => {
          inFlight.current = null;
          again.current = false;
          const changedOnDisk = isFileChanged(error);
          // Stop trying every few seconds; the reviewer decides what happens to the edit.
          if (changedOnDisk) paused.current = true;
          if (left.current) {
            editDrafts.set(scope.worktreeId, path, {
              text: latestText.current,
              base: lastSaved.current,
              state: changedOnDisk ? 'conflict' : 'failed',
            });
            toast.add({
              title: `${basename(path)} was not saved`,
              description: `${changedOnDisk ? 'It changed on disk after you opened it.' : reviewErrorMessage(error)} Your edit is kept: open the file and resume it.`,
              type: 'error',
            });
            return;
          }
          if (changedOnDisk) {
            // Said in place, with the ways out, under the toolbar.
            setRefused(lastSaved.current.fingerprint);
            setStatus('conflict');
            return;
          }
          setStatus('failed');
          toast.add({
            title: `${basename(path)} was not saved`,
            description: reviewErrorMessage(error),
            type: 'error',
          });
        },
      );
    inFlight.current = request;
    return request;
  };
  const saveRef = useRef(save);
  useLayoutEffect(() => {
    saveRef.current = save;
  });

  const editorOptions = useMemo<EditorOptions<'file', undefined, undefined>>(
    () => ({
      onAttach(editor) {
        editorRef.current = editor;
        editor.focus();
      },
      // Clicking into another pane, the sidebar or a dialog counts as leaving.
      onBlur() {
        void saveRef.current('blur');
      },
    }),
    [],
  );

  // Closing the tab or switching away unmounts the editor. What has not landed stays
  // as a draft the file offers to resume, and is saved on the way out unless the file
  // changed on disk.
  useEffect(() => {
    left.current = false;
    return () => {
      left.current = true;
      // As clearIdle does; inline, so the effect runs only when the file changes.
      if (idle.current != null) clearTimeout(idle.current);
      idle.current = null;
      if (
        latestText.current === lastSaved.current.text &&
        inFlight.current == null
      ) {
        editDrafts.remove(scope.worktreeId, path);
        return;
      }
      editDrafts.set(scope.worktreeId, path, {
        text: latestText.current,
        base: lastSaved.current,
        state: paused.current ? 'conflict' : 'saving',
      });
      // A tick later, so React's rehearsal unmount in development never saves.
      if (paused.current) return;
      setTimeout(() => {
        if (left.current) void saveRef.current('leave');
      });
    };
  }, [scope.worktreeId, path]);

  const onChange = (contents: string) => {
    latestText.current = contents;
    if (paused.current) return;
    setStatus(contents === lastSaved.current.text ? 'saved' : 'unsaved');
    clearIdle();
    idle.current = setTimeout(() => void saveRef.current('idle'), IDLE_SAVE_MS);
  };

  const done = () => {
    // During a conflict, Done closes the editor and keeps the edit to resume later.
    if (paused.current) {
      onDone();
      return;
    }
    void save('shortcut').then(() => {
      if (!paused.current) onDone();
    });
  };

  /** Retry: save the edit over the version now on disk, with that version's fingerprint. */
  const newVersion =
    read.kind === 'text' && read.fingerprint !== refused ? read : null;
  const retry = () => {
    if (newVersion == null) return;
    lastSaved.current = {
      text: newVersion.text,
      fingerprint: newVersion.fingerprint,
    };
    paused.current = false;
    setRefused(null);
    if (latestText.current === newVersion.text) setStatus('saved');
    else void save('retry');
  };

  /** Reload: drop the edit and read the file as it is now. */
  const reload = () => {
    clearIdle();
    latestText.current = lastSaved.current.text;
    onDone();
  };

  // Editing happens inside a text surface, so ⌘S must fire from inputs too.
  useHotkey(SHORTCUTS.saveFile, () => void save('shortcut'), {
    enabled: active,
    ignoreInputs: false,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {renderToolbar(
        <>
          <span
            role="status"
            aria-live="polite"
            className={cn(
              'flex items-center gap-1 text-[12px] text-muted-foreground',
              (status === 'conflict' || status === 'failed') &&
                'text-destructive',
            )}
          >
            {status === 'saving' && <Spinner className="size-3" />}
            {status === 'saved' && (
              <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            )}
            {STATUS_LABEL[status]}
          </span>
          <Button
            size="sm"
            className="h-7"
            onClick={done}
            title={
              status === 'conflict'
                ? 'Close the editor; the edit is kept to resume later'
                : undefined
            }
          >
            <Check className="size-3.5" />
            Done
          </Button>
        </>,
      )}
      {status === 'conflict' && (
        <div
          role="alert"
          className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b bg-amber-500/10 px-3.5 py-1.5 text-[12px] text-amber-800 dark:text-amber-200"
        >
          <span className="flex min-w-0 flex-1 basis-72 items-start gap-2">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {basename(path)} changed on disk after you opened it, so your edit
              is not saved. Retry saves it over the new version; Reload drops it
              and shows the new one.
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                copyText(
                  latestText.current,
                  'your draft',
                  `${basename(path)}, as you edited it.`,
                )
              }
            >
              <Copy />
              Copy draft
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={newVersion == null}
              title={
                newVersion == null
                  ? 'Reading the new version…'
                  : 'Save your edit over the version now on disk'
              }
              onClick={retry}
            >
              <Save />
              Retry
            </Button>
            <Button
              size="xs"
              variant="outline"
              title="Drop your edit and read the file as it is now"
              onClick={reload}
            >
              <RotateCcw />
              Reload
            </Button>
          </span>
        </div>
      )}
      {partOfChanges && (
        <p className="flex shrink-0 items-center gap-2 border-b bg-amber-500/10 px-3.5 py-1.5 text-[12px] text-amber-800 dark:text-amber-200">
          <TriangleAlert className="size-3.5 shrink-0" />
          This file is part of the agent’s changes. Saving edits what you are
          reviewing, and the agent may write it again.
        </p>
      )}

      <div className="code-scroll min-h-0 flex-1 overflow-auto">
        <EditProvider createEditor={createEditor}>
          <File
            file={file}
            edit
            editorOptions={editorOptions}
            options={{
              theme: PIERRE_THEME,
              themeType: resolvedTheme,
              overflow: preferences.lineOverflow,
              disableFileHeader: true,
              unsafeCSS: `${SURFACE_CSS}${FLUSH_TOP_CSS}`,
            }}
            onEditChange={(event) => onChange(event.file.contents)}
            // Saving goes through the API and the cache, never through the component.
            onEditComplete={() => 'reject'}
          />
        </EditProvider>
      </div>
    </div>
  );
}

/**
 * On a file whose edit did not land when its editor closed: says so, and reopens the
 * editor on that edit. The file document shows it under its toolbar while reading.
 */
export function ResumeEdit({
  scope,
  path,
  onResume,
}: {
  scope: ReviewScope;
  path: string;
  onResume: () => void;
}) {
  const draft = useEditDraft(scope.worktreeId, path);
  if (draft == null) return null;
  const saving = draft.state === 'saving';
  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-2 border-b bg-amber-500/10 px-3.5 py-1.5 text-[12px] text-amber-800 dark:text-amber-200"
    >
      {saving ? (
        <Spinner className="size-3.5 shrink-0" />
      ) : (
        <PencilLine className="size-3.5 shrink-0" />
      )}
      <span className="min-w-0 flex-1">
        {saving
          ? 'Saving your edit…'
          : draft.state === 'conflict'
            ? 'Your edit is not saved: the file changed on disk after you opened it.'
            : 'Your edit is not saved: the last save failed.'}
      </span>
      {!saving && (
        <Button size="xs" variant="outline" onClick={onResume}>
          <PencilLine />
          Resume edit
        </Button>
      )}
    </div>
  );
}
