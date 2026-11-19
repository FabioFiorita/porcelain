import { useWorkspaceWriteBlock } from '@/shared/workspace/connection';
import { Link } from '@tanstack/react-router';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { SparklesIcon } from 'lucide-react';
import { useWalkthroughWriters } from '../queries/walkthrough';
import { walkthroughWriterStatus } from '@porcelain/client/projects/rules';
import { refLabel } from '@porcelain/client/history/rules';
import { Button, buttonVariants } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  useInventory,
  walkthroughSettingsDialog,
} from '@/features/projects/index';
import { useLocalConnection } from '@/features/access/index';
import { useBranchBases } from '@/features/changes/index';
import type { DocumentProps } from '@/features/workspace/index';

export function WalkthroughStart({
  document,
  waiting,
  onWrite,
}: {
  document: DocumentProps;
  waiting: boolean;
  onWrite: () => void;
}) {
  const { connection } = document.context;
  const writeBlock = useWorkspaceWriteBlock(document.context);
  const local = useLocalConnection();
  const visible = document.interaction.hidden !== true;
  const { result, refresh } = useWalkthroughWriters(connection, visible);
  const settings = Option.getOrUndefined(AsyncResult.value(result));
  const project = useInventory(connection).projects.find(
    (entry) => entry.id === document.scope.projectId,
  );
  const writer = settings
    ? walkthroughWriterStatus(settings, project?.walkthroughSettings?.writer)
    : undefined;
  const branches = useBranchBases(
    document.scope,
    connection,
    visible && document.base === undefined,
  );
  const availableBases = Option.getOrUndefined(
    AsyncResult.value(branches.result),
  );
  const base = document.base ?? availableBases?.defaultRef;
  const failed = AsyncResult.isFailure(result);
  const noWriters = settings?.models.length === 0;
  const checkAgain = (
    <Button
      key="check-writers"
      variant="outline"
      size="sm"
      disabled={result.waiting}
      onClick={refresh}
    >
      {result.waiting && <Spinner aria-hidden="true" />}
      Check writers again
    </Button>
  );
  let note: string | undefined = writer
    ? `Since ${base ? refLabel(base) : 'the default branch'} · ${writer.label}`
    : undefined;
  let action = (
    <Button
      key="write-walkthrough"
      size="sm"
      disabled={Boolean(writeBlock) || waiting || !writer?.available}
      aria-description={writeBlock}
      onClick={onWrite}
    >
      <SparklesIcon data-icon="inline-start" />
      Write walkthrough
    </Button>
  );
  if (failed) {
    note = 'Could not check writers on the connected computer.';
    action = checkAgain;
  } else if (noWriters) {
    note = 'Sign in to Claude Code or Codex on the connected computer.';
    action = checkAgain;
  } else if (writer && !writer.available) {
    note = `${writer.label} is unavailable.`;
    action = project?.walkthroughSettings?.writer ? (
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          walkthroughSettingsDialog.openWithPayload({
            project,
            remote:
              connection.environmentId === local?.environmentId
                ? null
                : connection.environmentId,
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
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 className="text-section font-semibold">No walkthrough yet.</h1>
      {note && (
        <p
          role={failed ? 'alert' : undefined}
          className="min-w-0 text-ui text-muted-foreground"
        >
          {note}
        </p>
      )}
      {action}
    </header>
  );
}
