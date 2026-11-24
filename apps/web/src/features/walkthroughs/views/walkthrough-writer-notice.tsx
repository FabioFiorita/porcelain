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

type WriterCheck = ReturnType<typeof useWalkthroughWriter>;

export function WalkthroughWriterSettingsAction({
  document,
}: {
  document: DocumentProps;
}) {
  const { connection } = document.context;
  const local = useLocalConnection();
  const project = useInventory(connection).projects.find(
    (entry) => entry.id === document.scope.projectId,
  );
  return project?.walkthroughSettings?.writer ? (
    <Button
      variant="outline"
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
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
    >
      Settings → Changes &amp; Git
    </Link>
  );
}

export function CheckWalkthroughWriters({ writer }: { writer: WriterCheck }) {
  return (
    <PendingButton
      pending={writer.checking}
      variant="outline"
      size="sm"
      onClick={writer.refresh}
    >
      Check writers again
    </PendingButton>
  );
}

export function WalkthroughWriterNotice({
  document,
  writer,
  existingMessage,
  signedOut,
}: {
  document: DocumentProps;
  writer: WriterCheck;
  existingMessage?: string | undefined;
  signedOut?: boolean | undefined;
}) {
  const check = canRecheckWalkthroughWriters(writer, signedOut);
  const settings = Boolean(writer.status?.block);
  if (!check && !settings) return null;
  const note = walkthroughWriterNotice(writer, existingMessage);
  return (
    <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
      {note && <p role={writer.failed ? 'alert' : undefined}>{note}</p>}
      {check && <CheckWalkthroughWriters writer={writer} />}
      {settings && <WalkthroughWriterSettingsAction document={document} />}
    </div>
  );
}
