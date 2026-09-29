import { Undo2Icon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
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
import { fileName, type GitScope } from '../rules/git-action';
import { useDiscard } from '../commands/discard';
import { type GitActionStatus, statusFromChanges } from '../rules/status';
import { GitActionError } from './git-action-message';

export function DiscardButton({
  scope,
  context,
  path,
  hunk,
  variant = 'button',
  children,
}: {
  scope: GitScope;
  context: Parameters<typeof useDiscard>[1];
  path: string;
  hunk?: { scope: 'staged' | 'unstaged'; startLine: number; endLine: number };
  variant?: 'button' | 'compact' | 'quiet';
  children?: (trigger: ReactNode) => ReactNode;
}) {
  const connection = useAccessStore((state) => state.connection);
  const overview = useReviewOverview(scope, connection);
  const readChanges = useReadCurrentChanges(scope, connection);
  const [isOpen, setOpen] = useState(false);
  const [openedStatus, setOpenedStatus] = useState<GitActionStatus | null>(
    null,
  );
  const changes = overview?.changes;
  const status = changes ? statusFromChanges(changes) : null;
  const file = changes?.changes.find((entry) => entry.path === path);
  const candidate = openedStatus ?? status;
  const lines = hunk
    ? hunk.startLine === hunk.endLine
      ? `line ${hunk.startLine}`
      : `lines ${hunk.startLine}–${hunk.endLine}`
    : null;
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
  const trigger = shown ? (
    <Button
      size={variant === 'quiet' ? 'quiet' : variant === 'compact' ? 'xs' : 'sm'}
      variant={
        variant === 'quiet'
          ? 'quiet'
          : variant === 'compact'
            ? 'ghost'
            : 'destructive'
      }
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
      {variant === 'quiet' ? (
        <span className="max-[720px]:sr-only">Discard</span>
      ) : variant === 'compact' ? (
        'Discard selection'
      ) : (
        'Discard'
      )}
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
