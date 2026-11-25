import { useWorkspaceWriteBlock } from '@/shared/workspace/connection';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { refLabel } from '@porcelain/client/history/rules';
import { walkthroughWriterNotice } from '@porcelain/client/projects/rules';
import { Button } from '@/components/ui/button';
import {
  useBranchBases,
  useBranchChanges,
  useChanges,
} from '@/features/changes/index';
import { BriefingRow, BriefingRows } from './walkthrough-briefing';
import type { DocumentProps } from '@/features/workspace/index';
import type { useWalkthroughWriter } from '../queries/writer';
import { WalkthroughWriterMenu } from './walkthrough-writer-menu';
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
  const branch = Option.getOrUndefined(
    AsyncResult.value(
      useBranchChanges(document.scope, connection, document.base).result,
    ),
  );
  const uncommitted = useChanges(document.scope, connection).changes.length;
  const reads = readsLine({
    base: base ? refLabel(base) : 'the default branch',
    commits: branch?.commits,
    files: branch?.files.length,
    uncommitted,
  });
  let note = status ? '' : 'Checking the Walkthrough writer…';
  let action = (
    <Button
      disabled={Boolean(writeBlock) || status === undefined || waiting}
      aria-description={writeBlock}
      onClick={onWrite}
    >
      Write walkthrough
    </Button>
  );
  let settingsAction;
  if (failed || noWriters) {
    note = walkthroughWriterNotice(writer) ?? '';
    action = <CheckWalkthroughWriters writer={writer} />;
  } else if (status?.block) {
    note = status.block;
    const recovery = <WalkthroughWriterSettingsAction document={document} />;
    if (status.availability === 'unsupported-effort') settingsAction = recovery;
    else {
      action = <CheckWalkthroughWriters writer={writer} />;
      settingsAction = recovery;
    }
  }
  return (
    <section
      aria-labelledby="walkthrough-start"
      className="flex flex-col gap-4"
    >
      <header className="flex flex-col gap-1">
        <h1
          id="walkthrough-start"
          className="text-subpage-title font-semibold tracking-tight"
        >
          No walkthrough yet.
        </h1>
        {reads && <p className="text-prose text-foreground-2">{reads}</p>}
      </header>
      <BriefingRows label="What the walkthrough adds">
        <BriefingRow label="Your calls">
          <p className="py-1 text-ui">
            Decisions only you can make, each linked to its step.
          </p>
        </BriefingRow>
        <BriefingRow label="Verified">
          <p className="py-1 text-ui">
            Pull request checks and screenshots at the commit it reads, when the
            branch has a pull request.
          </p>
        </BriefingRow>
        <BriefingRow label="Steps">
          <p className="py-1 text-ui">
            The change in reading order, every claim beside its lines.
          </p>
        </BriefingRow>
      </BriefingRows>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {action}
        {!failed && !noWriters && (
          <WalkthroughWriterMenu document={document} writer={writer} />
        )}
        {note && (
          <p
            role={failed ? 'alert' : undefined}
            className="min-w-0 text-ui text-muted-foreground"
          >
            {note}
          </p>
        )}
        {settingsAction}
      </div>
    </section>
  );
}

function count(value: number, one: string, many: string) {
  return value === 1 ? `1 ${one}` : `${value} ${many}`;
}

function readsLine({
  base,
  commits,
  files,
  uncommitted,
}: {
  base: string;
  commits: number | undefined;
  files: number | undefined;
  uncommitted: number;
}) {
  if (commits === undefined || files === undefined) return undefined;
  const parts = [
    ...(commits > 0 ? [count(commits, 'commit', 'commits')] : []),
    ...(files > 0 ? [count(files, 'changed file', 'changed files')] : []),
    ...(uncommitted > 0
      ? [count(uncommitted, 'uncommitted file', 'uncommitted files')]
      : []),
  ];
  if (parts.length === 0) return undefined;
  const last = parts.pop();
  const list = parts.length > 0 ? `${parts.join(', ')} and ${last}` : last;
  return `It reads ${list} since ${base}.`;
}
