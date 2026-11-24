import { useWorkspaceWriteBlock } from '@/shared/workspace/connection';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { SparklesIcon } from 'lucide-react';
import { refLabel } from '@porcelain/client/history/rules';
import { walkthroughWriterNotice } from '@porcelain/client/projects/rules';
import { Button } from '@/components/ui/button';
import { useBranchBases } from '@/features/changes/index';
import type { DocumentProps } from '@/features/workspace/index';
import type { useWalkthroughWriter } from '../queries/writer';
import {
  CheckWalkthroughWriters,
  WalkthroughWriterSettingsAction,
} from './walkthrough-writer-notice';

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
  const { failed, noWriters, status } = writer;
  const writeBlock = useWorkspaceWriteBlock(document.context) ?? status?.block;
  const branches = useBranchBases(
    document.scope,
    connection,
    document.base === undefined,
  );
  const availableBases = Option.getOrUndefined(
    AsyncResult.value(branches.result),
  );
  const base = document.base ?? availableBases?.defaultRef;
  const since = `Since ${base ? refLabel(base) : 'the default branch'}`;
  let note = 'Checking Walkthrough writer…';
  if (status) note = status.availability ? `${since} · ${status.label}` : since;
  let action = (
    <Button
      size="sm"
      disabled={Boolean(writeBlock) || status === undefined || waiting}
      aria-description={writeBlock}
      onClick={onWrite}
    >
      <SparklesIcon data-icon="inline-start" />
      Write walkthrough
    </Button>
  );
  let settingsAction;
  if (failed || noWriters) {
    note = failed
      ? (walkthroughWriterNotice(writer) ?? '')
      : 'Sign in to Claude Code or Codex on the connected computer.';
    action = <CheckWalkthroughWriters writer={writer} />;
  } else if (status?.block) {
    note = status.block;
    const recovery = <WalkthroughWriterSettingsAction document={document} />;
    if (status.availability === 'unsupported-effort') settingsAction = recovery;
    else action = recovery;
  }
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 className="text-section font-semibold">No walkthrough yet.</h1>
      <p
        role={failed ? 'alert' : undefined}
        className="min-w-0 text-ui text-muted-foreground"
      >
        {note}
      </p>
      {action}
      {settingsAction}
    </header>
  );
}
