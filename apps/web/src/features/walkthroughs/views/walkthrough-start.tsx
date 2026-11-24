import { PendingButton } from '@/shared/views/pending-button';
import { useWorkspaceWriteBlock } from '@/shared/workspace/connection';
import { Link } from '@tanstack/react-router';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { SparklesIcon } from 'lucide-react';
import { refLabel } from '@porcelain/client/history/rules';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  useInventory,
  walkthroughSettingsDialog,
} from '@/features/projects/index';
import { useLocalConnection } from '@/features/access/index';
import { useBranchBases } from '@/features/changes/index';
import type { DocumentProps } from '@/features/workspace/index';

import type { useWalkthroughWriter } from '../queries/writer';

export function WalkthroughStart({
  document,
  writer,
  waiting,
  onWrite,
}: {
  document: DocumentProps;
  writer: ReturnType<typeof useWalkthroughWriter>;
  waiting: boolean;
  onWrite: () => void;
}) {
  const { connection } = document.context;
  const writeBlock = useWorkspaceWriteBlock(document.context);
  const local = useLocalConnection();
  const project = useInventory(connection).projects.find(
    (entry) => entry.id === document.scope.projectId,
  );
  const branches = useBranchBases(
    document.scope,
    connection,
    document.base === undefined,
  );
  const availableBases = Option.getOrUndefined(
    AsyncResult.value(branches.result),
  );
  const base = document.base ?? availableBases?.defaultRef;
  const { failed, noWriters, status } = writer;
  const checkAgain = (
    <PendingButton
      pending={writer.checking}
      variant="outline"
      size="sm"
      onClick={writer.refresh}
    >
      Check writers again
    </PendingButton>
  );
  let note: string | undefined = status
    ? `Since ${base ? refLabel(base) : 'the default branch'} · ${status.label}`
    : undefined;
  let action = (
    <Button
      size="sm"
      disabled={Boolean(writeBlock ?? writer.block) || waiting}
      aria-description={writeBlock ?? writer.block}
      onClick={onWrite}
    >
      <SparklesIcon data-icon="inline-start" />
      Write walkthrough
    </Button>
  );
  let settingsAction;
  if (failed) {
    note = 'Could not check writers on the connected computer.';
    action = checkAgain;
  } else if (noWriters) {
    note = 'Sign in to Claude Code or Codex on the connected computer.';
    action = checkAgain;
  } else if (
    status?.availability === 'missing-model' ||
    status?.availability === 'unsupported-effort'
  ) {
    note = writer.block;
    const recovery = project?.walkthroughSettings?.writer ? (
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
    if (status.availability === 'unsupported-effort') settingsAction = recovery;
    else action = recovery;
  } else if (writer.block) {
    note = writer.block;
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
      {settingsAction}
    </header>
  );
}
