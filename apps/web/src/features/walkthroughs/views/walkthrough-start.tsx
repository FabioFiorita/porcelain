import { useWorkspaceWriteBlock } from '@/shared/workspace/connection';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { refLabel } from '@porcelain/client/history/rules';
import {
  useBranchBases,
  useBranchChanges,
  useChanges,
} from '@/features/changes/index';
import type { DocumentProps } from '@/features/workspace/index';
import type { useWalkthroughWriter } from '../queries/writer';
import { WalkthroughWriterRow } from './walkthrough-writer-notice';

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
  const checking = status === undefined && !failed && !noWriters;
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
      <WalkthroughWriterRow
        document={document}
        writer={writer}
        actionFirst
        action={{
          label: 'Write walkthrough',
          variant: 'default',
          disabled: Boolean(writeBlock) || checking || waiting,
          description: writeBlock,
          onClick: onWrite,
        }}
      />
      <dl
        aria-label="What the walkthrough adds"
        className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-caption"
      >
        {ADDS.map(([label, detail]) => (
          <div key={label} className="contents">
            <dt className="text-foreground-2">{label}</dt>
            <dd className="text-muted-foreground">{detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const ADDS = [
  ['Your calls', 'Decisions only you can make, each linked to its step.'],
  ['Verified', 'Pull request checks and screenshots at the commit it reads.'],
  ['Steps', 'The change in reading order, every claim beside its lines.'],
] as const;

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
