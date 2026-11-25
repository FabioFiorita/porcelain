import { Link } from '@tanstack/react-router';
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
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
      {!writer.noWriters && (
        <WalkthroughWriterMenu document={document} writer={writer} />
      )}
      {reason && (
        <p
          role={writer.failed ? 'alert' : undefined}
          className="min-w-0 px-1 text-caption text-muted-foreground"
        >
          {reason}
        </p>
      )}
      {recheck && (
        <PendingButton
          pending={writer.checking}
          variant="ghost"
          size="sm"
          onClick={writer.refresh}
        >
          Check writers again
        </PendingButton>
      )}
      {settings && <SettingsAction document={document} />}
      {action && !unavailable && (
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
      )}
    </div>
  );
}
