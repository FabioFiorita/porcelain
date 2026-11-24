import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  fileOpening,
  type StepBlock,
  type WalkthroughComparison,
  type WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import { useBranchChanges, useChanges } from '@/features/changes/index';
import { recordedChecks } from '@porcelain/client/projects/rules';
import { changeId } from '@porcelain/client/changes/rules';
import {
  CheckResultIcon,
  type DocumentProps,
} from '@/features/workspace/index';
import { TruncatedText } from '@/shared/views/truncated-text';
import { RichText } from './rich-text';
import { WalkthroughExcerpt } from './walkthrough-excerpt';
import { WalkthroughProof } from './walkthrough-evidence';

type Files = Extract<StepBlock, { kind: 'files' }>;
type Checks = Extract<StepBlock, { kind: 'checks' }>;

function FileList({
  block,
  document,
}: {
  block: Files;
  document: DocumentProps;
}) {
  const branch = useBranchChanges(
    document.scope,
    document.context.connection,
    document.base,
  ).result;
  const worktree = useChanges(document.scope, document.context.connection);
  const read = {
    branch: Option.getOrUndefined(AsyncResult.value(branch))?.files,
    branchFailed: AsyncResult.isFailure(branch),
    worktree: worktree.changes,
  };
  return (
    <ul aria-label="Files" className="-mx-2 flex flex-col">
      {block.files.map((file) => (
        <li key={file.path}>
          <FileButton
            opening={fileOpening(read, file.path)}
            path={file.path}
            note={file.note}
            document={document}
          />
        </li>
      ))}
    </ul>
  );
}

function openFile(
  document: DocumentProps,
  path: string,
  opening: NonNullable<ReturnType<typeof fileOpening>>,
) {
  if (opening.kind === 'file') document.onOpen({ kind: 'file', path });
  else if (opening.kind === 'branch')
    document.onOpen({ kind: 'branch-file', path });
  else
    document.onOpen(
      { kind: 'change', path },
      opening.change ? { path, entry: changeId(opening.change) } : undefined,
    );
}

function FileButton({
  opening,
  path,
  note,
  document,
}: {
  opening: ReturnType<typeof fileOpening>;
  path: string;
  note: string;
  document: DocumentProps;
}) {
  return (
    <button
      type="button"
      disabled={opening === undefined}
      aria-busy={opening === undefined}
      className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:hover:bg-transparent @3xl:flex-row @3xl:items-baseline @3xl:gap-3"
      onClick={() => {
        if (opening) openFile(document, path, opening);
      }}
    >
      <span className="font-mono text-caption wrap-anywhere">{path}</span>
      <span className="text-caption text-muted-foreground">
        <RichText text={note} />
      </span>
    </button>
  );
}

function CheckList({ block }: { block: Checks }) {
  const checks = recordedChecks(block.checks);
  return (
    <section aria-label={checks.label} className="flex flex-col">
      <p className="font-mono text-caption text-muted-foreground">
        {checks.label}
      </p>
      <ul className="flex flex-col">
        {checks.results.map((result, index) => (
          <li
            key={`${result.name}:${index}`}
            className="flex h-7 min-w-0 items-center gap-2 text-ui"
          >
            <CheckResultIcon tone={result.tone} label={result.label} />
            <TruncatedText text={result.name} className="min-w-0 flex-1" />
            {result.detail && (
              <span className="shrink-0 text-caption text-muted-foreground">
                {result.detail}
              </span>
            )}
          </li>
        ))}
      </ul>
      {checks.more && (
        <p className="text-caption text-muted-foreground">
          More checks on the pull request
        </p>
      )}
    </section>
  );
}

export function StepBlocks({
  blocks,
  step,
  run,
  document,
}: {
  blocks: readonly StepBlock[];
  step: number;
  run: WalkthroughRun;
  document: DocumentProps;
}) {
  return blocks.map((block, index) => {
    switch (block.kind) {
      case 'excerpt':
        return (
          <WalkthroughExcerpt
            key={index}
            document={document}
            runId={run.id}
            step={step}
            excerpt={block.excerpt}
          />
        );
      case 'images':
        return (
          <WalkthroughProof
            key={index}
            scope={document.scope}
            context={document.context}
            run={run}
            items={block.screenshots}
          />
        );
      case 'files':
        return <FileList key={index} block={block} document={document} />;
      case 'checks':
        return <CheckList key={index} block={block} />;
    }
  });
}

export function ComparisonTable({
  comparison,
}: {
  comparison: WalkthroughComparison;
}) {
  return (
    <table className="w-full table-fixed border-collapse text-prose">
      <thead>
        <tr>
          {comparison.columns.map((column, index) => (
            <th
              key={index}
              scope="col"
              className="border-b pr-3 pb-1.5 text-left align-bottom text-caption font-medium text-muted-foreground last:pr-0"
            >
              <RichText text={column} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {comparison.rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="border-b last:border-b-0">
            {row.map((cell, index) => (
              <td
                key={index}
                className="py-1.5 pr-3 align-top text-foreground-2 wrap-anywhere last:pr-0"
              >
                <RichText text={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
