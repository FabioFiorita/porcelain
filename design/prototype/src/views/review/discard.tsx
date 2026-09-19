import { TriangleAlert, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { expectationFor, receiptFailed } from '../../domain/git-action';
import {
  basename,
  changeKind,
  changePath,
  type ReviewScope,
} from '../../domain/review';
import { useGitActions } from '../../query/git-actions';
import {
  reviewErrorMessage,
  useChanges,
  useRefreshChanges,
} from '../../query/review';
import { notifyFailure, notifySuccess } from '../workspace/notify';
import { changedSinceLooked, leftToBanner, receiptWords } from './git-feedback';

/** Long enough to reach Restore after reading the toast; the stash stays either way. */
const RESTORE_TOAST_MS = 10_000;

const linesLabel = (hunk: { startLine: number; endLine: number }) =>
  hunk.startLine === hunk.endLine
    ? `line ${hunk.startLine}`
    : `lines ${hunk.startLine}–${hunk.endLine}`;

/**
 * Discard the uncommitted changes of a file, or of one hunk (its new-side lines).
 * The discarded version is stashed first, so the toast offers Restore. Red, and
 * confirmed first. Placed by the review documents (a change's toolbar, a diff hunk).
 */
export function DiscardButton({
  scope,
  path,
  hunk,
  variant = 'icon',
}: {
  scope: ReviewScope;
  path: string;
  hunk?: { startLine: number; endLine: number };
  /** `icon` for a diff header or hunk, `button` for a toolbar. */
  variant?: 'icon' | 'button';
}) {
  const status = useChanges(scope);
  const refresh = useRefreshChanges(scope);
  const git = useGitActions(scope);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<{
    message: string;
    moved: boolean;
  } | null>(null);
  // Restore can be clicked after this button is gone (the hunk it sat on is discarded):
  // it sends the last list this button saw, where HEAD is where the discard left it.
  const latest = useRef(status);
  useEffect(() => {
    latest.current = status;
  });

  const change = status.changes.find((entry) => changePath(entry) === path);
  if (change == null) return null;
  const name = basename(path);
  const isNew = changeKind(change) === 'added';
  const what = hunk == null ? name : `${linesLabel(hunk)} of ${name}`;
  const label =
    hunk == null
      ? `Discard changes to ${name}`
      : `Discard this change to ${name}`;

  const restore = (stashOid: string) => {
    git
      .run({ action: 'stash-apply', stashOid }, expectationFor(latest.current))
      .then((receipt) => {
        if (!receiptFailed(receipt)) notifySuccess(`Restored ${what}`);
        else if (!leftToBanner(receipt))
          toast.add({
            title: `Could not restore ${what}`,
            description: receiptWords(receipt),
            type: 'error',
          });
      })
      .catch((error: unknown) =>
        notifyFailure(`Could not restore ${what}`, error),
      );
  };

  const discard = () => {
    if (pending) return;
    setPending(true);
    setRefusal(null);
    git
      .run({ action: 'discard', path, hunk }, expectationFor(status, [path]))
      .then((receipt) => {
        if (leftToBanner(receipt)) {
          setConfirming(false);
          return;
        }
        if (receiptFailed(receipt)) {
          // Stay open with Git's or the server's words; a moved file asks for another look first.
          const moved = changedSinceLooked(receipt);
          setRefusal({ message: receiptWords(receipt), moved });
          if (moved) void refresh();
          return;
        }
        setConfirming(false);
        const stashOid = receipt.result?.restoreStashOid;
        if (receipt.state === 'no-change') {
          toast.add({
            title: 'Nothing to discard',
            description: `${what} already matches the last commit.`,
            type: 'info',
          });
          return;
        }
        // Restore drops the backup, so the toast goes with the first click.
        const toastId = toast.add({
          title: `Discarded ${what}`,
          type: 'success',
          timeout: RESTORE_TOAST_MS,
          actionProps:
            stashOid == null
              ? undefined
              : {
                  children: 'Restore',
                  onClick: () => {
                    toast.close(toastId);
                    restore(stashOid);
                  },
                },
        });
      })
      .catch((error: unknown) =>
        setRefusal({ message: reviewErrorMessage(error), moved: false }),
      )
      .finally(() => setPending(false));
  };

  const open = () => {
    setRefusal(null);
    setConfirming(true);
  };

  return (
    <>
      {variant === 'icon' ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={label}
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
                onClick={open}
              />
            }
          >
            <Undo2 />
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {hunk == null ? 'Discard changes' : 'Discard this change'}
          </TooltipContent>
        </Tooltip>
      ) : (
        <Button variant="destructive" size="sm" onClick={open}>
          <Undo2 />
          Discard
        </Button>
      )}

      <AlertDialog
        open={confirming}
        onOpenChange={(next) => {
          if (!next && !pending) setConfirming(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Undo2 />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {hunk == null
                ? 'Discard changes to '
                : `Discard ${linesLabel(hunk)} of `}
              {/* Keeps "reviewed-files.ts" from breaking at its hyphen. */}
              <span
                className={
                  name.length <= 32 ? 'whitespace-nowrap' : 'break-all'
                }
              >
                {name}
              </span>
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {hunk == null
                ? isNew
                  ? 'This new file is removed. You can restore it.'
                  : 'The file goes back to the last commit. You can restore the changes.'
                : `${hunk.startLine === hunk.endLine ? 'This line goes' : 'These lines go'} back to the last commit; the rest of the file stays. You can restore ${hunk.startLine === hunk.endLine ? 'it' : 'them'}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p
            className="truncate rounded-xl bg-muted/50 px-3 py-2 font-mono text-[12px]"
            title={path}
          >
            {path}
          </p>
          {refusal != null && (
            <p
              role="alert"
              className={
                refusal.moved
                  ? 'flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-800 dark:text-amber-200'
                  : 'flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive'
              }
            >
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {refusal.message}
                {refusal.moved && ' Look at the diff again before discarding.'}
              </span>
            </p>
          )}
          <AlertDialogFooter>
            {/* Look again closes the confirm on the diff as it is now, read again. */}
            <AlertDialogCancel
              disabled={pending}
              onClick={() => refusal?.moved && void refresh()}
            >
              {refusal?.moved ? 'Look again' : 'Cancel'}
            </AlertDialogCancel>
            {!refusal?.moved && (
              <Button
                variant="destructive"
                disabled={pending}
                onClick={discard}
              >
                {pending ? <Spinner /> : <Undo2 />}
                Discard
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
