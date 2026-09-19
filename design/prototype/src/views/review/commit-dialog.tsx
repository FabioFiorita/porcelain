import { formatForDisplay, useHotkey } from '@tanstack/react-hotkeys';
import {
  Check,
  ChevronDown,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  PencilLine,
  Plus,
  RotateCcw,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import {
  amendRewritesPushed,
  type CommitGroup,
  expectationFor,
  gitActionBlocker,
  groupsBlocker,
  moveToGroup,
  receiptFailed,
  ungroupedPaths,
} from '../../domain/git-action';
import { shortOid } from '../../domain/history';
import { worktreeLabel } from '../../domain/inventory';
import {
  type CommitModel,
  commitModelLabel,
  groupedCommitModels,
  resolveCommitModel,
} from '../../domain/models';
import {
  basename,
  type ChangeKind,
  changeKind,
  listChanges,
  type ReviewScope,
} from '../../domain/review';
import { createId } from '../../lib/id';
import {
  isChangedSinceLooked,
  useCommitGroups,
  useCommitMessage,
  useCommitModels,
  useGitActions,
} from '../../query/git-actions';
import { discardRejection } from '../../query/mutation';
import {
  reviewErrorMessage,
  useChanges,
  useRefreshChanges,
} from '../../query/review';
import { DialogIcon } from '../workspace/dialog-icon';
import { notifyFailure, notifySuccess } from '../workspace/notify';
import { usePreferences } from '../workspace/preferences';
import { SHORTCUTS } from '../workspace/shortcuts';
import { FileTypeIcon } from './file-type-icon';
import {
  changedSinceLooked,
  type Look,
  leftToBanner,
  plural,
  receiptWords,
  whatMoved,
} from './git-feedback';
import { LookAgainButton } from './look-again';

type Mode = 'single' | 'amend' | 'groups';
type GroupProgress = 'waiting' | 'committing' | 'done' | 'failed';
/** A refusal: what the server said, and the look it refused. The list follows the live one until the next try. */
type Moved = { message: string; before: Look };

const KIND_LABELS: Record<ChangeKind, string> = {
  added: 'Added',
  modified: 'Modified',
  deleted: 'Deleted',
  renamed: 'Renamed',
  conflicted: 'Conflicted',
};

const subjectOf = (message: string) => message.trim().split('\n')[0] ?? '';
const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

type Props = {
  scope: ReviewScope;
  open: boolean;
  /** `amend` opens on "Amend last commit"; the reviewer can still switch. */
  mode?: 'single' | 'amend';
  onOpenChange: (open: boolean) => void;
};

/**
 * Commit from the reviewer's side: one commit of the files you pick, the last
 * commit amended, or the proposed groups committed in order. The list is what the
 * dialog showed when it opened, and every commit sends exactly those paths with
 * their fingerprints; if one moved, the server refuses and the list looks again.
 */
export function CommitDialog({
  scope,
  open,
  mode = 'single',
  onOpenChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      // A stray click outside must not throw away a message or reviewed groups; nor can it close mid-run.
      disablePointerDismissal
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="max-h-[85svh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-xl"
      >
        {/* The popup unmounts when closed, so every open starts from the current changes and cancels any draft. */}
        <CommitForm
          scope={scope}
          initialMode={mode}
          onBusy={setBusy}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CommitForm({
  scope,
  initialMode,
  onBusy,
  onClose,
}: {
  scope: ReviewScope;
  initialMode: 'single' | 'amend';
  onBusy: (busy: boolean) => void;
  onClose: () => void;
}) {
  const live = useChanges(scope);
  const refresh = useRefreshChanges(scope);
  const git = useGitActions(scope);
  const draft = useCommitMessage(scope);
  const grouper = useCommitGroups(scope);
  const { preferences } = usePreferences();
  // The models the server's agent CLIs run; without one, messages are written by hand.
  const drafting = useCommitModels();
  const model =
    drafting.models == null
      ? null
      : resolveCommitModel(drafting.models, preferences.commitModel);

  // What the reviewer is looking at: the list when the dialog opened. After a
  // refusal it follows the live list, and the next try takes that as the new look.
  const [looked, setLooked] = useState(live);
  const [moved, setMoved] = useState<Moved | null>(null);
  const status = moved == null ? looked : live;
  const movedMarks = moved == null ? null : whatMoved(moved.before, live);
  const takeLook = (): Look => {
    if (moved == null) return looked;
    setLooked(live);
    setMoved(null);
    return live;
  };
  /** A refusal: note what the server said, and read the list again so it shows what moved. */
  const refused = (message: string, before: Look) => {
    setMoved({ message, before });
    void refresh();
  };

  const amendBlocker = gitActionBlocker(
    'amend',
    status,
    preferences.pullStrategy,
  );
  const commitBlocker = gitActionBlocker(
    'commit',
    status,
    preferences.pullStrategy,
  );
  // A merge finishes with one commit of the whole index: Git refuses a partial commit
  // during a merge, so what the merge staged and every conflicted file go in.
  const merging = status.inProgress === 'merge';
  const listed = listChanges(status.changes);
  const unmerged = listed.filter(
    (file) => file.change.scope === 'unmerged',
  ).length;
  const partOfMerge = new Set(
    listed
      .filter((file) => file.change.scope === 'unmerged' || file.staged != null)
      .map((file) => file.path),
  );
  const [mode, setMode] = useState<Mode>(
    initialMode === 'amend' && amendBlocker == null ? 'amend' : 'single',
  );
  const [busy, setBusyState] = useState(false);
  const setBusy = (next: boolean) => {
    setBusyState(next);
    onBusy(next);
  };

  // Drafts and groupings in flight. Closing the dialog unmounts this form and cancels them.
  const inFlight = useRef(new Set<AbortController>());
  useEffect(() => {
    const controllers = inFlight.current;
    return () => {
      for (const controller of controllers) controller.abort();
      controllers.clear();
    };
  }, []);
  const cancellable = () => {
    const controller = new AbortController();
    inFlight.current.add(controller);
    return controller;
  };

  // A file Git lists as staged and unstaged is one file here, as everywhere.
  const files = listed.map((file) => ({
    path: file.path,
    kind: changeKind(file.change),
  }));
  const kindOf = (path: string) =>
    files.find((file) => file.path === path)?.kind;
  const filesOf = (look: Look, paths: readonly string[]) =>
    expectationFor(look, paths).files ?? [];

  // Single commit: every file unless excluded. Amend: only the files you add.
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [editingFiles, setEditingFiles] = useState(false);
  // Git proposes this message for a merge; it needs no model.
  const [message, setMessage] = useState(() =>
    merging
      ? `Merge ${status.branch.upstream ?? 'upstream'} into ${worktreeLabel(status.branch.name)}`
      : '',
  );
  const last = status.headCommit;
  const [amendMessage, setAmendMessage] = useState(() =>
    last == null
      ? ''
      : [last.subject, last.body]
          .filter((part) => part != null && part !== '')
          .join('\n\n'),
  );
  const [phase, setPhase] = useState<'idle' | 'generating' | 'committing'>(
    'idle',
  );
  /** Why the last commit or amend did not run, said in the dialog: a toast would sit under it. */
  const [refusal, setRefusal] = useState<string | null>(null);
  const amending = mode === 'amend';
  const pickedIn = (look: Look) =>
    listChanges(look.changes)
      .map((file) => file.path)
      .filter((path) => (amending ? added.has(path) : !excluded.has(path)));
  const selected = pickedIn(status);
  const rewritesPushed = amending && amendRewritesPushed(status);

  // Groups
  const [grouping, setGrouping] = useState<CommitGroup[] | null>(null);
  const [groupingFailed, setGroupingFailed] = useState(false);
  const [progress, setProgress] = useState<Record<string, GroupProgress>>({});
  /** HEAD after the last group this dialog committed, so the next one expects it. */
  const [ownHead, setOwnHead] = useState<string | null>(null);
  const groupsController = useRef<AbortController | null>(null);
  const groups = grouping ?? [];
  const started = Object.keys(progress).length > 0;
  const remaining = groups.filter((group) => progress[group.id] !== 'done');
  const left = ungroupedPaths(
    files.map((file) => file.path),
    groups,
  );

  const generate = async (
    paths: string[],
    look: Look,
  ): Promise<string | null> => {
    if (model == null) return null;
    const controller = cancellable();
    try {
      const response = await draft.submit({
        files: filesOf(look, paths),
        model,
        signal: controller.signal,
      });
      return response.message;
    } catch (error) {
      if (controller.signal.aborted || isAbort(error)) return null;
      if (isChangedSinceLooked(error)) refused(reviewErrorMessage(error), look);
      else notifyFailure('Could not generate a message', error);
      return null;
    } finally {
      inFlight.current.delete(controller);
    }
  };

  const requestGroups = () => {
    if (model == null) return;
    const look = takeLook();
    groupsController.current?.abort();
    const controller = cancellable();
    groupsController.current = controller;
    setGroupingFailed(false);
    setProgress({});
    setOwnHead(null);
    grouper
      .submit({
        files: filesOf(
          look,
          listChanges(look.changes).map((file) => file.path),
        ),
        model,
        signal: controller.signal,
      })
      .then(
        (response) =>
          setGrouping(
            response.groups.map((group) => ({ id: createId(), ...group })),
          ),
        (error: unknown) => {
          if (controller.signal.aborted || isAbort(error)) return;
          setGroupingFailed(true);
          if (isChangedSinceLooked(error))
            refused(reviewErrorMessage(error), look);
          else notifyFailure('Could not group the changes', error);
        },
      )
      .finally(() => inFlight.current.delete(controller));
  };

  const setGroups = (next: CommitGroup[]) =>
    setGrouping((current) => (current == null ? current : next));

  const commitOne = async () => {
    if (busy || phase !== 'idle') return;
    setRefusal(null);
    const look = takeLook();
    const paths = pickedIn(look);
    // A merge resolved to what HEAD had changes nothing and still needs its commit.
    if (!amending && !merging && paths.length === 0) return;
    let text = (amending ? amendMessage : message).trim();
    if (amending && text === '') return;
    if (text === '') {
      // An empty message is drafted first. Closing the dialog meanwhile cancels the draft and the commit.
      setPhase('generating');
      const drafted = await generate(paths, look);
      setPhase('idle');
      if (drafted == null) return;
      text = drafted;
      setMessage(drafted);
    }
    setPhase('committing');
    setBusy(true);
    try {
      const receipt = await git.run(
        { action: amending ? 'amend' : 'commit', message: text, paths },
        expectationFor(look, paths),
      );
      if (changedSinceLooked(receipt)) {
        refused(receiptWords(receipt), look);
        return;
      }
      if (receiptFailed(receipt)) {
        if (!leftToBanner(receipt)) setRefusal(receiptWords(receipt));
        return;
      }
      const head = receipt.result?.headOid;
      if (amending) {
        notifySuccess(
          'Amended the last commit',
          `${subjectOf(text)}${head == null ? '' : ` · now ${shortOid(head)}`}`,
        );
      } else {
        notifySuccess(
          'Committed',
          `${subjectOf(text)} · ${plural(paths.length, 'file')}`,
        );
      }
      setBusy(false);
      onClose();
    } catch (error) {
      setRefusal(reviewErrorMessage(error));
    } finally {
      setPhase('idle');
      setBusy(false);
    }
  };

  const commitGroups = async () => {
    if (
      grouping == null ||
      busy ||
      moved != null ||
      groupsBlocker(groups) != null
    )
      return;
    const look = looked;
    setBusy(true);
    const total = groups.length;
    let landed = total - remaining.length;
    let head = ownHead ?? look.headOid;
    setProgress((current) =>
      Object.fromEntries(
        groups.map((group) => [
          group.id,
          current[group.id] === 'done' ? 'done' : 'waiting',
        ]),
      ),
    );
    try {
      for (const group of remaining) {
        setProgress((current) => ({ ...current, [group.id]: 'committing' }));
        let reason: string | null = null;
        let interrupted = false;
        try {
          // Each group expects HEAD where the previous one left it, and its files as the reviewer saw them.
          const receipt = await git.run(
            {
              action: 'commit',
              message: group.message.trim(),
              paths: group.paths,
            },
            { ...expectationFor(look, group.paths), headOid: head },
          );
          if (changedSinceLooked(receipt)) refused(receiptWords(receipt), look);
          if (receiptFailed(receipt)) {
            reason = receiptWords(receipt);
            interrupted = leftToBanner(receipt);
          } else {
            head = receipt.result?.headOid ?? head;
          }
        } catch (error) {
          reason = reviewErrorMessage(error);
        }
        if (reason != null) {
          // Stop at the first failure: later groups may depend on this one.
          setProgress((current) => ({ ...current, [group.id]: 'failed' }));
          // A server restart is told by the banner; the card still reads Failed.
          if (!interrupted)
            toast.add({
              title: `Committed ${landed} of ${total}`,
              description: reason,
              type: 'error',
            });
          return;
        }
        landed += 1;
        setOwnHead(head);
        setProgress((current) => ({ ...current, [group.id]: 'done' }));
      }
      notifySuccess(
        `${plural(total, 'commit')} made`,
        'They are at the top of History.',
      );
      setBusy(false);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    discardRejection(mode === 'groups' ? commitGroups() : commitOne());

  const singleBlocker =
    commitBlocker ??
    (selected.length === 0 && !merging
      ? 'Pick at least one file.'
      : message.trim() !== '' || model != null
        ? null
        : drafting.isPending
          ? 'Write a message, or wait for the models.'
          : 'Write a message.');
  const amendMessageBlocker =
    amendMessage.trim() === '' ? 'Write a message.' : null;
  const groupBlocker =
    grouping == null
      ? null
      : moved != null
        ? 'Regroup first.'
        : groupsBlocker(groups);
  const blocker =
    mode === 'single'
      ? singleBlocker
      : mode === 'amend'
        ? (amendBlocker ?? amendMessageBlocker)
        : groupBlocker;
  const branch = status.branch;
  const toggle = (set: ReadonlySet<string>, path: string) => {
    const next = new Set(set);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return next;
  };

  // Mod+Enter commits from anywhere in the dialog, the message box included.
  useHotkey(
    SHORTCUTS.commit,
    () => {
      if (blocker == null) submit();
    },
    { ignoreInputs: false },
  );

  return (
    <>
      <DialogHeader className="flex-row items-center gap-3 text-left">
        <DialogIcon icon={amending ? PencilLine : GitCommitHorizontal} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle>
            {amending ? 'Amend last commit' : 'Commit changes'}
          </DialogTitle>
          <DialogDescription>
            {amending
              ? 'The last commit is replaced by one with this message and the files you add.'
              : 'Committed steps fold away in the review and show up in History.'}
          </DialogDescription>
        </div>
      </DialogHeader>

      <ScrollArea className="-mr-3 min-h-0">
        <div className="flex flex-col gap-4 pr-3">
          <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-[12.5px]">
            <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">Branch</span>
            <span className="truncate font-medium">
              {worktreeLabel(branch.name)}
            </span>
            {branch.upstream != null && (
              <span className="ml-auto shrink-0 text-muted-foreground">
                {branch.behind > 0
                  ? `${branch.ahead} ahead, ${branch.behind} behind ${branch.upstream}`
                  : `${branch.ahead} ahead of ${branch.upstream}`}
              </span>
            )}
          </div>

          {merging && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-800 dark:text-amber-200">
              <GitMerge className="mt-0.5 size-3.5 shrink-0" />
              <span>
                This commit finishes the merge of{' '}
                {branch.upstream ?? 'upstream'}: everything the merge staged
                goes into it.
                {unmerged > 0 &&
                  ` ${unmerged === 1 ? 'So does the conflicted file' : `So do all ${unmerged} conflicted files`}, so remove every conflict marker first.`}
              </span>
            </p>
          )}

          <Tabs
            value={mode}
            onValueChange={(value) => {
              setMode(value as Mode);
              if (value === 'groups' && grouping == null && !grouper.isPending)
                requestGroups();
            }}
          >
            <TabsList className="w-full">
              <TabsTrigger
                value="single"
                className="flex-1 px-0"
                disabled={busy || commitBlocker != null}
              >
                Single commit
              </TabsTrigger>
              <TabsTrigger
                value="amend"
                className="flex-1 px-0"
                disabled={busy || amendBlocker != null}
              >
                Amend last
              </TabsTrigger>
              {/* A merge ends in exactly one commit, so it cannot be split. */}
              <TabsTrigger
                value="groups"
                className="flex-1 px-0"
                disabled={busy || commitBlocker != null || merging}
              >
                <Sparkles className="size-3.5" />
                Use groups
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {mode !== 'groups' ? (
            <>
              {amending && last != null && (
                <section className="flex flex-col gap-2">
                  <div className="flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px]">
                    <span className="shrink-0 text-muted-foreground">
                      Replaces
                    </span>
                    {status.headOid != null && (
                      <span className="shrink-0 font-mono">
                        {shortOid(status.headOid)}
                      </span>
                    )}
                    <span
                      className="min-w-0 flex-1 truncate font-medium"
                      title={last.subject}
                    >
                      {last.subject}
                    </span>
                  </div>
                  {rewritesPushed && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive"
                    >
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium break-words">
                          Already pushed to {branch.upstream}
                        </span>
                        <span>
                          Amending rewrites pushed history. Afterwards your
                          branch and its upstream disagree, and only a force
                          push publishes the new commit. Porcelain does not
                          force push.
                        </span>
                      </span>
                    </div>
                  )}
                </section>
              )}

              <section className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-[12.5px]">
                  <span className="font-medium">
                    {amending ? 'Files to add' : 'Files'}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    ({selected.length} of {files.length})
                  </span>
                  {!amending && (
                    <Button
                      size="xs"
                      variant="ghost"
                      className="ml-auto"
                      disabled={busy}
                      onClick={() => setEditingFiles((current) => !current)}
                    >
                      {editingFiles ? 'Done' : 'Edit'}
                    </Button>
                  )}
                </div>
                {files.length === 0 ? (
                  <p className="rounded-xl border border-dashed px-3 py-3 text-[12.5px] text-muted-foreground">
                    No uncommitted files. Amending changes only the message.
                  </p>
                ) : (
                  <ul className="flex flex-col rounded-xl border p-1">
                    {files.map((file) => {
                      const included = amending
                        ? added.has(file.path)
                        : !excluded.has(file.path);
                      // Git refuses a partial commit during a merge.
                      const required =
                        !amending && merging && partOfMerge.has(file.path);
                      const mark = movedMarks?.marks.get(file.path);
                      const label = (
                        <FileLabel
                          path={file.path}
                          muted={!included}
                          mark={mark}
                        >
                          {included
                            ? KIND_LABELS[file.kind]
                            : amending
                              ? 'Not added'
                              : 'Excluded'}
                        </FileLabel>
                      );
                      return (
                        <li key={file.path}>
                          {amending || editingFiles ? (
                            <button
                              type="button"
                              aria-pressed={included}
                              disabled={busy || required}
                              title={
                                required
                                  ? 'Part of the merge: it goes into this commit.'
                                  : undefined
                              }
                              onClick={() =>
                                amending
                                  ? setAdded((current) =>
                                      toggle(current, file.path),
                                    )
                                  : setExcluded((current) =>
                                      toggle(current, file.path),
                                    )
                              }
                              className="flex h-7 w-full items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-muted disabled:hover:bg-transparent"
                            >
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'grid size-4 shrink-0 place-items-center rounded-[5px] border',
                                  included
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-input',
                                )}
                              >
                                {included && <Check className="size-3" />}
                              </span>
                              {label}
                            </button>
                          ) : (
                            <div className="flex h-7 items-center gap-2 px-2">
                              {label}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1 text-[12.5px]">
                  <label
                    htmlFor="commit-message"
                    className="mr-auto font-medium"
                  >
                    Commit message{' '}
                    {!amending && model != null && (
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    )}
                  </label>
                  {!amending && (drafting.isPending || model != null) && (
                    <>
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={
                          busy ||
                          draft.isPending ||
                          model == null ||
                          selected.length === 0
                        }
                        onClick={() => {
                          const look = takeLook();
                          void generate(pickedIn(look), look).then(
                            (text) => text != null && setMessage(text),
                          );
                        }}
                      >
                        {draft.isPending ? (
                          <Spinner className="size-3" />
                        ) : (
                          <Sparkles />
                        )}
                        Generate with AI
                      </Button>
                      <ModelMenu models={drafting.models ?? []} model={model} />
                    </>
                  )}
                  {/* Beside the label, since the list above can push the note below out of view. */}
                  {!amending &&
                    !drafting.isPending &&
                    drafting.models?.length === 0 && (
                      <span className="text-[12px] text-muted-foreground">
                        No agent CLI on the server to draft it
                      </span>
                    )}
                  {!amending &&
                    drafting.models == null &&
                    drafting.error != null && (
                      <>
                        <span
                          className="text-[12px] text-destructive"
                          title={reviewErrorMessage(drafting.error)}
                        >
                          Drafting is off: the models did not load
                        </span>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => void drafting.refetch()}
                        >
                          <RotateCcw />
                          Retry
                        </Button>
                      </>
                    )}
                </div>
                <Textarea
                  id="commit-message"
                  value={amending ? amendMessage : message}
                  onChange={(event) =>
                    amending
                      ? setAmendMessage(event.target.value)
                      : setMessage(event.target.value)
                  }
                  placeholder={
                    amending || model == null
                      ? 'The commit message'
                      : 'Leave empty to generate one'
                  }
                  disabled={busy || (!amending && draft.isPending)}
                  className="min-h-24"
                />
                {!amending && <DraftingNote drafting={drafting} />}
              </section>
            </>
          ) : grouper.isPending ? (
            <p className="flex items-center justify-center gap-2 py-8 text-[12.5px] text-muted-foreground">
              <Spinner className="size-3.5" />
              Grouping {plural(files.length, 'file')} with{' '}
              {commitModelLabel(drafting.models ?? [], model ?? '')}…
            </p>
          ) : grouping == null ? (
            model == null ? (
              <div className="py-6">
                <DraftingNote drafting={drafting} purpose="groups" />
              </div>
            ) : (
              moved == null && (
                <div className="flex flex-col items-center gap-2 py-6 text-[12.5px] text-muted-foreground">
                  {groupingFailed
                    ? "Couldn't group the changes."
                    : `Split the changes into commits with ${commitModelLabel(drafting.models ?? [], model)}.`}
                  <Button size="xs" variant="outline" onClick={requestGroups}>
                    {groupingFailed ? 'Try again' : 'Group the changes'}
                  </Button>
                </div>
              )
            )
          ) : (
            <>
              <div className="flex items-center gap-1 text-[12.5px]">
                <span className="mr-auto text-muted-foreground">
                  {plural(groups.length, 'commit')}, made in this order. Edit
                  them before committing.
                </span>
                {moved == null && (
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={busy}
                    onClick={requestGroups}
                  >
                    <RotateCcw />
                    Regroup
                  </Button>
                )}
                {model != null && (
                  <ModelMenu models={drafting.models ?? []} model={model} />
                )}
              </div>
              {groups.map((group, index) => {
                const state = progress[group.id];
                const locked = busy || state === 'done';
                return (
                  <section
                    key={group.id}
                    aria-label={`Commit ${index + 1}`}
                    className="rounded-xl border"
                  >
                    <header className="flex h-9 items-center gap-2 border-b px-3">
                      <span className="grid size-5 place-items-center rounded-full bg-muted text-[11px] font-medium tabular-nums">
                        {index + 1}
                      </span>
                      <span className="text-[12px] text-muted-foreground">
                        {plural(group.paths.length, 'file')}
                      </span>
                      <span className="ml-auto flex items-center gap-1.5 text-[12px]">
                        <ProgressLabel state={state} />
                      </span>
                      {!locked && (
                        <Button
                          size="xs"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={() =>
                            setGroups(
                              groups.filter((entry) => entry.id !== group.id),
                            )
                          }
                        >
                          Leave uncommitted
                        </Button>
                      )}
                    </header>
                    <div className="flex flex-col gap-1.5 p-2">
                      <Textarea
                        aria-label={`Message for commit ${index + 1}`}
                        value={group.message}
                        placeholder="Commit message"
                        disabled={locked}
                        onChange={(event) =>
                          setGroups(
                            groups.map((entry) =>
                              entry.id === group.id
                                ? { ...entry, message: event.target.value }
                                : entry,
                            ),
                          )
                        }
                        className="min-h-14"
                      />
                      <ul className="flex flex-col">
                        {group.paths.map((path) => (
                          <li
                            key={path}
                            className="flex h-7 items-center gap-2 pl-2"
                          >
                            <FileLabel
                              path={path}
                              mark={movedMarks?.marks.get(path)}
                            >
                              {kindOf(path) == null
                                ? ''
                                : KIND_LABELS[kindOf(path) as ChangeKind]}
                            </FileLabel>
                            {!locked && (
                              <MoveMenu
                                path={path}
                                groups={groups}
                                progress={progress}
                                currentId={group.id}
                                onMove={(targetId) =>
                                  setGroups(moveToGroup(groups, path, targetId))
                                }
                                onNew={() => {
                                  const id = createId();
                                  setGroups(
                                    moveToGroup(
                                      [
                                        ...groups,
                                        { id, message: '', paths: [] },
                                      ],
                                      path,
                                      id,
                                    ),
                                  );
                                }}
                              />
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>
                );
              })}
              {left.length > 0 && (
                <section
                  aria-label="Left uncommitted"
                  className="rounded-xl border border-dashed"
                >
                  <header className="flex h-9 items-center px-3 text-[12px] text-muted-foreground">
                    Left uncommitted · {plural(left.length, 'file')}
                  </header>
                  <ul className="flex flex-col px-2 pb-2">
                    {left.map((path) => (
                      <li
                        key={path}
                        className="flex h-7 items-center gap-2 pl-2"
                      >
                        <FileLabel
                          path={path}
                          muted
                          mark={movedMarks?.marks.get(path)}
                        >
                          {kindOf(path) == null
                            ? ''
                            : KIND_LABELS[kindOf(path) as ChangeKind]}
                        </FileLabel>
                        {!busy && (
                          <MoveMenu
                            path={path}
                            groups={groups}
                            progress={progress}
                            currentId={null}
                            onMove={(targetId) =>
                              setGroups(moveToGroup(groups, path, targetId))
                            }
                            onNew={() => {
                              const id = createId();
                              setGroups(
                                moveToGroup(
                                  [...groups, { id, message: '', paths: [] }],
                                  path,
                                  id,
                                ),
                              );
                            }}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Next to the buttons, so a refusal shows where the reviewer clicked, whatever the scroll. */}
      <div className="flex flex-col gap-3">
        {refusal != null && mode !== 'groups' && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 break-words">
              <span className="font-medium">
                {amending ? 'Amend' : 'Commit'} did not run.
              </span>{' '}
              {refusal}
            </span>
          </p>
        )}
        {moved != null && movedMarks != null && (
          <MovedNote
            message={moved.message}
            gone={movedMarks.gone}
            action={
              mode === 'groups' ? (
                <Button size="xs" variant="outline" onClick={requestGroups}>
                  <RotateCcw />
                  Regroup
                </Button>
              ) : (
                <LookAgainButton onLook={refresh} />
              )
            }
          >
            {mode === 'groups'
              ? 'These groups were made from the old list.'
              : 'The list shows what moved. Check it, then try again.'}
          </MovedNote>
        )}
        <DialogFooter className="sm:items-center">
          <p className="mr-auto text-[12px] text-muted-foreground">
            {blocker ??
              `${formatForDisplay(SHORTCUTS.commit)} to ${amending ? 'amend' : 'commit'}`}
          </p>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          {mode === 'single' ? (
            <Button
              disabled={busy || phase !== 'idle' || singleBlocker != null}
              onClick={submit}
            >
              {phase === 'idle' ? <GitCommitHorizontal /> : <Spinner />}
              {phase === 'generating'
                ? 'Writing the message…'
                : phase === 'committing'
                  ? 'Committing…'
                  : 'Commit'}
            </Button>
          ) : mode === 'amend' ? (
            <Button
              variant={rewritesPushed ? 'destructive' : 'default'}
              disabled={busy || blocker != null}
              onClick={submit}
            >
              {busy ? <Spinner /> : <PencilLine />}
              {busy
                ? 'Amending…'
                : rewritesPushed
                  ? 'Amend pushed commit'
                  : 'Amend'}
            </Button>
          ) : (
            <Button
              disabled={busy || grouping == null || groupBlocker != null}
              onClick={submit}
            >
              {busy ? <Spinner /> : <GitCommitHorizontal />}
              {busy
                ? 'Committing…'
                : grouping == null
                  ? 'Commit'
                  : started
                    ? `Commit the remaining ${remaining.length}`
                    : `Commit ${plural(groups.length, 'commit')}`}
            </Button>
          )}
        </DialogFooter>
      </div>
    </>
  );
}

/** "Changed since you looked": the server's words, what left the list, and what to do now. */
function MovedNote({
  message,
  gone,
  action,
  children,
}: {
  message: string;
  gone: readonly string[];
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-800 dark:text-amber-200"
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium break-words">{message}</span>
        <span>
          {children}
          {gone.length > 0 &&
            ` No longer changed: ${gone.map(basename).join(', ')}.`}
        </span>
      </span>
      {action}
    </div>
  );
}

/**
 * Which model drafts messages and groups; the same setting as in Settings. It never
 * waits for a draft: a change applies to the next one.
 */
function ModelMenu({
  models,
  model,
}: {
  models: readonly CommitModel[];
  model: string | null;
}) {
  const { setPreference } = usePreferences();
  if (model == null) {
    return (
      <span className="flex h-6 items-center gap-1.5 px-2 text-[12px] text-muted-foreground">
        <Spinner className="size-3" />
        Loading models…
      </span>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="xs"
            variant="ghost"
            className="text-muted-foreground"
            aria-label="Model for drafting"
          />
        }
      >
        {commitModelLabel(models, model)}
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuRadioGroup
          value={model}
          onValueChange={(value) =>
            setPreference('commitModel', value as string)
          }
        >
          {groupedCommitModels(models).map((group) => (
            <DropdownMenuGroup key={group.provider}>
              <DropdownMenuLabel>Draft with {group.provider}</DropdownMenuLabel>
              {group.models.map((entry) => (
                <DropdownMenuRadioItem key={entry.id} value={entry.id}>
                  {entry.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Why drafting or grouping is off: the server has no agent CLI, or its models did
 * not load. Nothing once there is a model.
 */
function DraftingNote({
  drafting,
  purpose = 'message',
}: {
  drafting: ReturnType<typeof useCommitModels>;
  purpose?: 'message' | 'groups';
}) {
  if (drafting.isPending && purpose === 'groups') {
    return (
      <p className="flex items-center justify-center gap-2 text-[12.5px] text-muted-foreground">
        <Spinner className="size-3.5" />
        Loading models…
      </p>
    );
  }
  if (
    drafting.isPending ||
    (drafting.models != null && drafting.models.length > 0)
  )
    return null;
  // Beside the message, a failed load already says so with Retry.
  if (drafting.models == null && purpose === 'message') return null;
  const off = purpose === 'groups' ? 'Grouping' : 'Drafting a message';
  return (
    <p className="flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2 text-[12px] text-muted-foreground">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
      {drafting.models == null ? (
        <>
          <span className="min-w-0 flex-1">
            {off} is unavailable: the server’s models did not load.{' '}
            {reviewErrorMessage(drafting.error)}
          </span>
          <Button
            size="xs"
            variant="outline"
            onClick={() => void drafting.refetch()}
          >
            <RotateCcw />
            Retry
          </Button>
        </>
      ) : (
        <span className="min-w-0 flex-1">
          {off} needs an agent CLI on the server. Install and sign in to Claude
          Code or Codex there.
          {purpose === 'message'
            ? ' You can still write the message yourself.'
            : ' Until then, use Single commit.'}
        </span>
      )}
    </p>
  );
}

/** File-type icon, path truncated from the start so the file name always shows, and a trailing note. */
function FileLabel({
  path,
  muted = false,
  mark,
  children,
}: {
  path: string;
  muted?: boolean;
  /** Set after a "changed since you looked" refusal. */
  mark?: 'changed' | 'new';
  children: ReactNode;
}) {
  return (
    <>
      <FileTypeIcon path={path} className="size-4 shrink-0" />
      <span
        dir="rtl"
        title={path}
        className={cn(
          'min-w-0 flex-1 truncate text-left text-[12.5px]',
          muted && 'text-muted-foreground',
        )}
      >
        <bdi>{path}</bdi>
      </span>
      {mark != null && (
        <span className="shrink-0 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10.5px] text-amber-700 dark:text-amber-300">
          {mark === 'new' ? 'New' : 'Changed'}
        </span>
      )}
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {children}
      </span>
    </>
  );
}

function MoveMenu({
  path,
  groups,
  progress,
  currentId,
  onMove,
  onNew,
}: {
  path: string;
  groups: readonly CommitGroup[];
  progress: Record<string, GroupProgress>;
  currentId: string | null;
  onMove: (targetId: string) => void;
  onNew: () => void;
}) {
  const targets = groups
    .map((group, index) => ({ group, index }))
    .filter(
      ({ group }) => group.id !== currentId && progress[group.id] !== 'done',
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="xs"
            variant="ghost"
            className="shrink-0 text-muted-foreground"
            aria-label={`Move ${path} to`}
          />
        }
      >
        Move to
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {targets.length > 0 && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Move {basename(path)} to</DropdownMenuLabel>
              {targets.map(({ group, index }) => (
                <DropdownMenuItem
                  key={group.id}
                  onClick={() => onMove(group.id)}
                >
                  <span className="w-3 shrink-0 text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <span className="truncate">
                    {subjectOf(group.message) || 'No message yet'}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={onNew}>
          <Plus />
          New commit
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProgressLabel({ state }: { state: GroupProgress | undefined }) {
  switch (state) {
    case 'waiting':
      return <span className="text-muted-foreground">Waiting</span>;
    case 'committing':
      return (
        <>
          <Spinner className="size-3" />
          Committing…
        </>
      );
    case 'done':
      return (
        <>
          <Check className="size-3.5" />
          Committed
        </>
      );
    case 'failed':
      return <span className="text-destructive">Failed</span>;
    default:
      return null;
  }
}
