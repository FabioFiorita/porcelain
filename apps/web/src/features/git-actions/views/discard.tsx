import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
import { Undo2Icon } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
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
import {
  useReadCurrentChanges,
  useReviewOverview,
} from '@/features/changes/index';
import { fileName, type GitScope } from '@porcelain/client/git-actions/rules';
import { useDiscard } from '../commands/discard';
import {
  type GitActionStatus,
  statusFromChanges,
} from '@porcelain/client/git-actions/rules';
import { GitActionError } from './git-action-message';

export function DiscardButton({
  scope,
  context,
  path,
  hunk,
  variant = 'button',
  signal,
  hiddenTrigger = false,
  children,
}: {
  scope: GitScope;
  context: Parameters<typeof useDiscard>[1];
  path: string;
  hunk?: { scope: 'staged' | 'unstaged'; startLine: number; endLine: number };
  variant?: 'button' | 'compact' | 'quiet';
  signal?: number;
  hiddenTrigger?: boolean;
  children?: (trigger: ReactNode) => ReactNode;
}) {
  const { connection } = context;
  const overview = Option.getOrUndefined(
    AsyncResult.value(useReviewOverview(scope, connection)),
  );
  const readChanges = useReadCurrentChanges(scope, connection);
  const [isOpen, setOpen] = useState(false);
  const [openedStatus, setOpenedStatus] = useState<GitActionStatus | null>(
    null,
  );
  const changes = overview;
  const status = changes ? statusFromChanges(changes) : null;
  const file = changes?.changes.find((entry) => entry.path === path);
  const candidate = openedStatus ?? status;
  const lines = (() => {
    if (hunk) {
      if (hunk.startLine === hunk.endLine) {
        return `line ${hunk.startLine}`;
      }
      return `lines ${hunk.startLine}–${hunk.endLine}`;
    }
    return null;
  })();
  const what = lines ? `${lines} of ${fileName(path)}` : fileName(path);
  const discard = useDiscard(scope, context, {
    path,
    hunk,
    what,
    look: candidate,
    readChanges,
    notify: (notice) => toast.add(notice),
    dismissNotice: (id) => toast.close(id),
    close: () => setOpen(false),
  });
  const { busy, error, uncertain } = discard;
  const shown = Boolean(candidate && (file || isOpen));
  const openedSignal = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (signal === undefined || signal === openedSignal.current || !status)
      return;
    openedSignal.current = signal;
    discard.reset();
    setOpenedStatus(status);
    setOpen(true);
  }, [signal, status]);
  const trigger =
    shown && !hiddenTrigger ? (
      <Button
        size={variant === 'button' ? 'sm' : 'xs'}
        variant={variant === 'button' ? 'destructive' : 'ghost'}
        aria-label={
          hunk
            ? `Discard ${lines} of ${fileName(path)}`
            : `Discard changes to ${fileName(path)}`
        }
        onClick={() => {
          discard.reset();
          setOpenedStatus(status);
          setOpen(true);
        }}
      >
        <Undo2Icon />
        {(() => {
          if (variant === 'quiet') {
            return <span className="max-narrow:sr-only">Discard</span>;
          }
          if (variant === 'compact') {
            return 'Discard selection';
          }
          return 'Discard';
        })()}
      </Button>
    ) : null;
  const dialog = shown ? (
    <AlertDialog open={isOpen} onOpenChange={(next) => !busy && setOpen(next)}>
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
          <p key={line} role="status" className="text-xs text-muted-foreground">
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
              <Button disabled={busy} onClick={discard.checkOutcome}>
                {busy ? 'Checking…' : 'Check outcome'}
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={busy}
                onClick={discard.run}
              >
                {busy ? 'Discarding…' : 'Discard'}
              </Button>
            ))}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;
  if (children)
    return (
      <>
        {children(trigger)}
        {dialog}
      </>
    );
  return (
    <>
      {trigger}
      {dialog}
    </>
  );
}
