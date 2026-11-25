import type {
  StepBlock,
  WalkthroughComparison,
  WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import {
  pullRequestRollup,
  recordedChecks,
} from '@porcelain/client/projects/rules';
import {
  CheckResultIcon,
  type DocumentProps,
} from '@/features/workspace/index';
import { TruncatedText } from '@/shared/views/truncated-text';
import { RichText } from './rich-text';
import { WalkthroughExcerpt } from './walkthrough-excerpt';
import { WalkthroughDiagram } from './walkthrough-diagram';
import { WalkthroughProof } from './walkthrough-evidence';
import { useCitedFiles, type FileSize } from './cited-files';
import { EvidenceBox } from './evidence-box';

type Files = Extract<StepBlock, { kind: 'files' }>;
type Checks = Extract<StepBlock, { kind: 'checks' }>;
type Tone = ReturnType<typeof recordedChecks>['results'][number]['tone'];

function Size({ size }: { size: FileSize }) {
  return (
    <span className="shrink-0 font-mono text-caption tabular-nums">
      <span
        className={
          size.additions === 0 ? 'text-muted-foreground' : 'text-add-fg'
        }
      >
        +{size.additions}
      </span>{' '}
      <span
        className={
          size.deletions === 0 ? 'text-muted-foreground' : 'text-del-fg'
        }
      >
        −{size.deletions}
      </span>
    </span>
  );
}

function FileChange({
  size,
  uncommitted,
}: {
  size: FileSize | undefined;
  uncommitted: boolean;
}) {
  return (
    <span className="flex shrink-0 items-baseline gap-2">
      {size && <Size size={size} />}
      {uncommitted && (
        <span className="text-caption text-muted-foreground">Uncommitted</span>
      )}
    </span>
  );
}

function FileList({
  block,
  document,
}: {
  block: Files;
  document: DocumentProps;
}) {
  const cited = useCitedFiles(
    document,
    block.files.map((file) => file.path),
  );
  return (
    <ul
      aria-label="Files"
      className="divide-y overflow-hidden rounded-md border"
    >
      {block.files.map((file) => {
        const opening = cited.opening(file.path);
        const size = cited.size(file.path);
        return (
          <li key={file.path}>
            <button
              type="button"
              disabled={opening === undefined}
              aria-busy={opening === undefined}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 px-3 py-1.5 text-left hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:hover:bg-transparent"
              onClick={() => cited.open(file.path)}
            >
              <span className="font-mono text-caption wrap-anywhere">
                {file.path}
              </span>
              <FileChange
                size={size}
                uncommitted={cited.uncommitted(file.path)}
              />
              {file.note && (
                <span className="col-span-2 text-caption text-muted-foreground">
                  <RichText text={file.note} />
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function checksTone(checks: Checks['checks']): Tone {
  return pullRequestRollup(checks.state).tone;
}

function CheckList({ block }: { block: Checks }) {
  const checks = recordedChecks(block.checks);
  return (
    <EvidenceBox
      label={checks.label}
      heading={
        <>
          <CheckResultIcon tone={checksTone(block.checks)} />
          <span className="font-mono">{checks.label}</span>
        </>
      }
    >
      <ul className="flex flex-col py-1">
        {checks.results.map((result, index) => (
          <li
            key={`${result.name}:${index}`}
            className="flex h-7 min-w-0 items-center gap-2 px-3 text-ui"
          >
            <CheckResultIcon tone={result.tone} label={result.label} />
            <TruncatedText text={result.name} className="min-w-0 flex-1" />
            <span className="shrink-0 text-caption text-muted-foreground">
              {result.detail ?? result.label}
            </span>
          </li>
        ))}
      </ul>
      {checks.more && (
        <p className="border-t px-3 py-1.5 text-caption text-muted-foreground">
          More checks on the pull request
        </p>
      )}
    </EvidenceBox>
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
      case 'diagram':
        return (
          <WalkthroughDiagram
            key={index}
            diagram={block.diagram}
            document={document}
            runId={run.id}
            step={step}
          />
        );
    }
  });
}

export function ComparisonTable({
  comparison,
}: {
  comparison: WalkthroughComparison;
}) {
  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <table className="w-full table-fixed border-collapse text-ui">
        <thead>
          <tr className="bg-muted/50">
            {comparison.columns.map((column, index) => (
              <th
                key={index}
                scope="col"
                className="border-b px-3 py-1.5 text-left align-bottom text-caption font-medium text-foreground not-last:border-r"
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
                  className="px-3 py-1.5 align-top text-foreground-2 wrap-anywhere not-last:border-r"
                >
                  <RichText text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
