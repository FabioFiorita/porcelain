import { Undo2Icon } from 'lucide-react';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useAccessStore } from '@/features/access/index';
import {
  useReadCurrentChanges,
  useReviewOverview,
} from '@/features/changes/index';
import type { Receipt } from '@/features/review/model/git-action';
import {
  basename,
  type ChangeList,
  comparisons,
  type ReviewScope,
} from '@/features/review/model/review';
import { useGitAction } from '@/features/review/queries/git-actions';
import {
  changedSinceLooked,
  expectationFor,
  gitErrorMessage,
  receiptFailed,
  receiptWords,
} from './git-action-feedback';
import { GitActionError } from './git-action-message';
import type { GitActionStatus } from './git-action-options';

export function DiscardButton({
  scope,
  path,
  hunk,
  variant = 'button',
}: {
  scope: ReviewScope;
  path: string;
  hunk?: { scope: 'staged' | 'unstaged'; startLine: number; endLine: number };
  variant?: 'button' | 'compact';
}) {
  const connection = useAccessStore((state) => state.connection);
  const overview = useReviewOverview(scope, connection);
  const readChanges = useReadCurrentChanges(scope, connection);
  const discard = useGitAction(scope, 'discard');
  const restore = useGitAction(scope, 'stash-apply');
  const [open, setOpen] = useState(false);
  const [openedStatus, setOpenedStatus] = useState<GitActionStatus | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; moved: boolean } | null>(
    null,
  );
  const changes = overview?.changes;
  const status = changes ? actionStatus(changes) : null;
  const file = changes?.changes.find((entry) => entry.path === path);
  const candidate = openedStatus ?? status;
  if (!candidate || (!file && !open)) return null;
  const look = candidate;
  const uncertain = Boolean(discard.operation && !discard.canStartNew);

  const lines = hunk
    ? hunk.startLine === hunk.endLine
      ? `line ${hunk.startLine}`
      : `lines ${hunk.startLine}–${hunk.endLine}`
    : null;
  const what = lines ? `${lines} of ${basename(path)}` : basename(path);

  async function readCurrentChanges(): Promise<GitActionStatus> {
    return actionStatus(await readChanges());
  }

  function finish(receipt: Receipt) {
    if (receiptFailed(receipt)) {
      setError({
        text: receiptWords(receipt),
        moved: changedSinceLooked(receipt),
      });
      return;
    }
    setOpen(false);
    const stashOid = receipt.result?.restoreStashOid;
    if (receipt.state === 'no-change') {
      toast.add({
        title: 'Nothing to discard',
        description: `${what} already matches the last commit.`,
        type: 'info',
      });
      return;
    }
    const toastId = toast.add({
      title: `Discarded ${what}`,
      type: 'success',
      timeout: 10_000,
      ...(stashOid
        ? {
            actionProps: {
              children: 'Restore',
              onClick: () => {
                void (async () => {
                  let restoreLook: GitActionStatus;
                  try {
                    restoreLook = await readCurrentChanges();
                  } catch (cause) {
                    toast.add({
                      title: `Could not restore ${what}`,
                      description: gitErrorMessage(cause),
                      type: 'error',
                    });
                    return;
                  }
                  const currentPaths =
                    restoreLook.files
                      ?.filter((entry) => entry.fingerprint != null)
                      .map((entry) => entry.path) ?? [];
                  const restoreNow = () => {
                    toast.close(toastId);
                    void restore
                      .run(
                        {
                          action: 'stash-apply',
                          stashOid,
                          restoreIndex: receipt.result?.restoreIndex ?? false,
                        },
                        expectationFor(
                          restoreLook,
                          currentPaths,
                          undefined,
                          true,
                        ),
                      )
                      .then((result) => {
                        if (receiptFailed(result))
                          throw new Error(receiptWords(result));
                        toast.add({
                          title: `Restored ${what}`,
                          type: 'success',
                        });
                      })
                      .catch((cause: unknown) =>
                        toast.add({
                          title: `Could not restore ${what}`,
                          description: gitErrorMessage(cause),
                          type: 'error',
                        }),
                      );
                  };
                  restoreNow();
                })();
              },
            },
          }
        : {}),
    });
  }

  async function run() {
    if (busy || uncertain) return;
    setBusy(true);
    setError(null);
    try {
      const receipt = await discard.run(
        { action: 'discard', path, ...(hunk ? { hunk } : {}) },
        expectationFor(look, [path]),
      );
      finish(receipt);
    } catch (cause) {
      setError({ text: gitErrorMessage(cause), moved: false });
    } finally {
      setBusy(false);
    }
  }

  async function checkOutcome() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const receipt = await discard.recover.submit();
      finish(receipt);
    } catch (cause) {
      setError({ text: gitErrorMessage(cause), moved: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        size={variant === 'compact' ? 'xs' : 'sm'}
        variant={variant === 'compact' ? 'ghost' : 'destructive'}
        aria-label={
          hunk
            ? `Discard ${lines} of ${basename(path)}`
            : `Discard changes to ${basename(path)}`
        }
        onClick={() => {
          setError(null);
          setOpenedStatus(status);
          setOpen(true);
        }}
      >
        <Undo2Icon />
        {variant === 'compact' ? 'Discard selection' : 'Discard'}
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard {what}?</AlertDialogTitle>
            <AlertDialogDescription>
              {hunk
                ? 'Select one complete changed hunk. Only that hunk is reverted; partial selections are refused. A recovery copy is saved first.'
                : 'The file goes back to the last commit. You can restore the changes.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p
            className="truncate rounded-lg bg-muted/50 px-3 py-2 font-mono text-xs"
            title={path}
          >
            {path}
          </p>
          {error && (
            <GitActionError text={error.text}>
              {error.moved ? ' Look at the diff again before discarding.' : ''}
            </GitActionError>
          )}
          {discard.operation?.receipt?.progress.map((line) => (
            <p
              key={line}
              role="status"
              className="text-xs text-muted-foreground"
            >
              {line}
            </p>
          ))}
          {uncertain && !discard.operation?.receipt && (
            <p role="status" className="text-sm text-muted-foreground">
              The response was lost. Check the existing discard request before
              trying again.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {error?.moved ? 'Look again' : 'Cancel'}
            </AlertDialogCancel>
            {!error?.moved &&
              (uncertain ? (
                <Button disabled={busy} onClick={() => void checkOutcome()}>
                  {busy ? 'Checking…' : 'Check outcome'}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void run()}
                >
                  {busy ? 'Discarding…' : 'Discard'}
                </Button>
              ))}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function actionStatus(changes: ChangeList): GitActionStatus {
  return {
    statusToken: changes.statusToken,
    inProgress: changes.inProgress,
    mergeHeadOid: changes.mergeHeadOid,
    headOid: changes.headOid,
    branch: changes.branch,
    changes: comparisons(changes),
    files: changes.changes.map(({ path, fingerprint }) => ({
      path,
      fingerprint,
    })),
  };
}
