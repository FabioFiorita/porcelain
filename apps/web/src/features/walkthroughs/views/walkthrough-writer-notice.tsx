import { Link } from '@tanstack/react-router';
import { CircleAlertIcon } from 'lucide-react';
import {
  canRecheckWalkthroughWriters,
  walkthroughWriterNotice,
} from '@porcelain/client/projects/rules';
import { Button, buttonVariants } from '@/components/ui/button';
import { useLocalConnection } from '@/features/access/index';
import {
  useInventory,
  walkthroughSettingsDialog,
} from '@/features/projects/index';
import type { DocumentProps } from '@/features/workspace/index';
import { PendingButton } from '@/shared/views/pending-button';
import type { useWalkthroughWriter } from '../queries/writer';
import { WalkthroughWriterMenu } from './walkthrough-writer-menu';

type WriterCheck = ReturnType<typeof useWalkthroughWriter>;

export type WriterAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean | undefined;
  description?: string | undefined;
  variant?: 'default' | 'outline' | 'ghost' | undefined;
};

function SettingsAction({ document }: { document: DocumentProps }) {
  const { connection } = document.context;
  const local = useLocalConnection();
  const project = useInventory(connection).projects.find(
    (entry) => entry.id === document.scope.projectId,
  );
  return project?.walkthroughSettings?.writer ? (
    <Button
      variant="ghost"
      size="sm"
      onClick={() =>
        void walkthroughSettingsDialog.open({
          payload: {
            project,
            remote:
              connection.environmentId === local?.environmentId
                ? null
                : connection.environmentId,
          },
        })
      }
    >
      Project walkthrough settings
    </Button>
  ) : (
    <Link
      to="/settings/$section"
      params={{ section: 'git' }}
      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
    >
      Settings → Changes &amp; Git
    </Link>
  );
}

export function WalkthroughWriterRow({
  document,
  writer,
  action,
  existingMessage,
  signedOut,
  actionFirst = false,
}: {
  document: DocumentProps;
  writer: WriterCheck;
  actionFirst?: boolean;
  action?: WriterAction | undefined;
  existingMessage?: string | undefined;
  signedOut?: boolean | undefined;
}) {
  const unavailable = writer.noWriters || Boolean(writer.status?.block);
  const recheck = canRecheckWalkthroughWriters(writer, signedOut);
  const reason = walkthroughWriterNotice(writer, existingMessage);
  const settings =
    !writer.noWriters && !writer.failed && Boolean(writer.status?.block);
  const button = action && !unavailable && (
    <Button
      size="sm"
      variant={action.variant ?? 'outline'}
      className={actionFirst ? 'order-first mr-1' : undefined}
      disabled={action.disabled}
      aria-description={action.description}
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );
  if (recheck && !settings) {
    const notice = (
      <div
        role={writer.failed ? 'alert' : 'status'}
        className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-muted px-3 py-2"
      >
        <p className="flex min-w-0 flex-1 basis-56 items-start gap-2 text-ui text-foreground-2">
          <CircleAlertIcon
            aria-hidden
            className="mt-0.75 size-3.5 shrink-0 text-muted-foreground"
          />
          <span className="min-w-0 text-pretty">
            {reason ?? 'Sign in on the connected computer, then check again.'}
          </span>
        </p>
        <PendingButton
          pending={writer.checking}
          variant={
            action?.variant === 'default' && unavailable ? 'default' : 'outline'
          }
          size="sm"
          onClick={writer.refresh}
        >
          Check again
        </PendingButton>
      </div>
    );
    const shown = action && !unavailable && (
      <Button
        size="sm"
        variant={action.variant ?? 'outline'}
        disabled={action.disabled}
        aria-description={action.description}
        onClick={action.onClick}
      >
        {action.label}
      </Button>
    );
    return (
      <div className="flex w-full min-w-0 flex-col items-start gap-2">
        {actionFirst && shown}
        {notice}
        {!actionFirst && shown}
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
      {!writer.noWriters && (
        <WalkthroughWriterMenu document={document} writer={writer} />
      )}
      {reason && (
        <p className="min-w-0 text-caption text-muted-foreground">{reason}</p>
      )}
      {recheck && (
        <PendingButton
          pending={writer.checking}
          variant="ghost"
          size="sm"
          onClick={writer.refresh}
        >
          Check again
        </PendingButton>
      )}
      {settings && <SettingsAction document={document} />}
      {button}
    </div>
  );
}
