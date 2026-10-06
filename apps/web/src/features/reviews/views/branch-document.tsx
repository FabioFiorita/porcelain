import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
import { type ReactNode, Suspense, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DIFF_WINDOW_FILES } from '@/config/limits';
import {
  type BranchFile,
  branchErrorMessage,
  branchFilePaths,
  branchName,
  branchRange,
} from '@porcelain/client/changes/rules';
import {
  commitEntry,
  useBranchChanges,
  useBranchDiffs,
  useReviewOverview,
} from '@/features/changes/index';
import { shortOid } from '@/features/history/index';
import type { CodeEntry } from '../adapters/code-entries';
import { useReviewedMarks } from '../queries/reviewed';
import type { DocumentInteraction } from '../rules/documents';
import {
  basename,
  type BranchChangeItem,
  type DiffContent,
  mergeBranchChanges,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import {
  branchReviewRange,
  type ReviewRange,
} from '@porcelain/client/reviews/rules';
import { CodeDocument } from './code-document';
import { DocumentToolbar } from './document-toolbar';
import { ReadMoreFiles } from './read-more-files';
import { MarkAllReviewed, ReviewedControl } from './reviewed-control';
import { ReviewEmpty } from './review-empty';
import { type ConnectionContext } from '@/shared/workspace/connection';

type Props = {
  scope: ReviewScope;
  context: ConnectionContext;
  interaction: DocumentInteraction;
  base: string | undefined;
};

export function BranchDocument(props: Props) {
  return <BranchCode {...props} path={undefined} />;
}

export function BranchFileDocument({
  path,
  ...props
}: Props & { path: string }) {
  return <BranchCode {...props} path={path} />;
}

function BranchCode({
  scope,
  context,
  interaction,
  base,
  path,
}: Props & { path: string | undefined }) {
  const { connection } = context;
  const changes = useBranchChanges(scope, connection, base);
  if (changes.isError)
    return (
      <div className="flex flex-col items-center p-4">
        <ReviewEmpty
          title="Branch could not be compared"
          description={branchErrorMessage(changes.error)}
        />
        <Button variant="outline" onClick={() => void changes.refetch()}>
          Compare again
        </Button>
      </div>
    );
  if (changes.isPending || changes.data == null) return <ComparingBranch />;
  if (changes.data.base == null)
    return (
      <ReviewEmpty
        title="No default branch"
        description="Choose the branch this one is compared against in the Branch list."
      />
    );
  return (
    <Suspense fallback={<ComparingBranch />}>
      <BranchMarkedCode
        scope={scope}
        context={context}
        interaction={interaction}
        branch={changes.data}
        path={path}
      />
    </Suspense>
  );
}

function ComparingBranch() {
  return (
    <p role="status" className="p-4 text-sm">
      Comparing the branch…
    </p>
  );
}

function BranchMarkedCode({
  scope,
  context,
  interaction,
  branch,
  path,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  interaction: DocumentInteraction;
  branch: NonNullable<ReturnType<typeof useBranchChanges>['data']>;
  path: string | undefined;
}) {
  const range = branchReviewRange(branch);
  const marks = useReviewedMarks(scope, context, range);
  if (branch.base == null) return null;
  const items = mergeBranchChanges(
    branch.files,
    marks,
    path == null ? undefined : [path],
  );
  if (path != null && items.length === 0)
    return (
      <ReviewEmpty
        title="Not changed on this branch"
        description={`${path} has no committed change since ${branchName(branch.base.ref)}.`}
      />
    );
  return (
    <BranchDiffs
      scope={scope}
      context={context}
      interaction={interaction}
      range={range}
      items={items}
      single={path != null}
      branch={{
        base: branch.base.ref,
        head: branch.head,
        mergeBaseOid: branch.mergeBaseOid ?? '',
        commits: branch.commits,
        diffRange: branchRange(branch),
      }}
    />
  );
}

function BranchDiffs({
  scope,
  context,
  interaction,
  range,
  items,
  single,
  branch,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  interaction: DocumentInteraction;
  range: ReviewRange;
  items: readonly BranchChangeItem[];
  single: boolean;
  branch: {
    base: string;
    head: { oid: string; branch: string | undefined };
    mergeBaseOid: string;
    commits: number;
    diffRange: ReturnType<typeof branchRange>;
  };
}) {
  const { connection } = context;
  const overview = Option.getOrUndefined(
    AsyncResult.value(useReviewOverview(scope, connection)),
  );
  const [window, setWindow] = useState({
    of: branch.head.oid,
    shown: DIFF_WINDOW_FILES,
  });
  const shown =
    window.of === branch.head.oid ? window.shown : DIFF_WINDOW_FILES;
  const reached = items.slice(0, shown);
  const diffs = useBranchDiffs(
    scope,
    connection,
    branch.diffRange,
    reached.map(branchFilePaths),
  );
  const patchOf = (file: BranchFile) =>
    diffs.patches.get(branchFilePaths(file).join('\0'));
  const control = (item: BranchChangeItem, compact: boolean) => (
    <ReviewedControl
      key={`review:${item.path}`}
      scope={scope}
      context={context}
      path={item.path}
      fingerprint={item.fingerprint}
      status={item.reviewStatus}
      range={range}
      compact={compact}
    />
  );
  const entries = reached.flatMap((item): CodeEntry[] => {
    const entry = commitEntry(branch.head.oid, item, patchOf(item));
    if (entry == null) return [];
    return [
      {
        ...entry,
        id: `branch:${item.path}`,
        comment: {
          filePath: item.path,
          comparison: { kind: 'branch', base: branch.base },
          revision: branch.head.oid,
          contentFingerprint: item.fingerprint,
        },
        review: {
          path: item.path,
          fingerprint: item.fingerprint,
          reviewed: item.reviewStatus === 'reviewed',
          stale: item.reviewStatus === 'stale',
          control: control(item, true),
        },
      },
    ];
  });
  const rendered = new Set(entries.map((entry) => entry.path));
  const omitted = reached.filter((item) => !rendered.has(item.path));
  const more = items.length - reached.length;
  const uncommitted = overview?.changes.length ?? 0;
  const [first] = items;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CodeDocument
        scope={scope}
        context={context}
        interaction={interaction}
        range={range}
        {...(interaction.reveal?.compose
          ? { commentRequest: interaction.reveal.nonce }
          : {})}
        entries={entries}
        toolbar={(collapseControl) =>
          single && first ? (
            <DocumentToolbar
              title={basename(first.path)}
              subtitle={`${first.path} · on the branch`}
            >
              {control(first, false)}
            </DocumentToolbar>
          ) : (
            <DocumentToolbar
              title="Branch"
              subtitle={`${items.length} ${items.length === 1 ? 'file' : 'files'} changed`}
            >
              {collapseControl}
              <MarkAllReviewed
                scope={scope}
                context={context}
                entries={items}
                range={range}
              />
            </DocumentToolbar>
          )
        }
        header={() => (
          <BranchHeader
            branch={branch}
            single={single}
            uncommitted={uncommitted}
            omitted={omitted}
            patchOf={patchOf}
            failed={diffs.isError}
            onRetry={diffs.retry}
            control={(item) => control(item, true)}
          />
        )}
      />
      <ReadMoreFiles
        more={more}
        pending={diffs.isPending}
        onReadMore={() =>
          setWindow({
            of: branch.head.oid,
            shown: shown + DIFF_WINDOW_FILES,
          })
        }
      />
    </div>
  );
}

function BranchHeader({
  branch,
  single,
  uncommitted,
  omitted,
  patchOf,
  failed,
  onRetry,
  control,
}: {
  branch: {
    base: string;
    head: { oid: string; branch: string | undefined };
    mergeBaseOid: string;
    commits: number;
  };
  single: boolean;
  uncommitted: number;
  omitted: readonly BranchChangeItem[];
  patchOf: (file: BranchFile) => DiffContent | undefined;
  failed: boolean;
  onRetry: () => void;
  control: (item: BranchChangeItem) => ReactNode;
}) {
  const head =
    branch.head.branch == null ? 'This commit' : branchName(branch.head.branch);
  return (
    <section className="mx-4 mt-3 rounded-xl border px-4 py-3">
      {!single && (
        <>
          <h2 className="text-sm font-semibold">
            {head} since {branchName(branch.base)}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
            <span>
              {branch.commits} {branch.commits === 1 ? 'commit' : 'commits'}
            </span>
            <span>
              from{' '}
              <span className="font-mono">{shortOid(branch.mergeBaseOid)}</span>{' '}
              to <span className="font-mono">{shortOid(branch.head.oid)}</span>
            </span>
            <Badge variant="secondary" className="h-4">
              {branchName(branch.base)}
            </Badge>
          </div>
        </>
      )}
      {uncommitted > 0 && (
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          Uncommitted changes are not part of the branch review. Review them
          under Uncommitted.
        </p>
      )}
      {failed && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          Some patches could not be read.
          <Button size="xs" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </p>
      )}
      {omitted.length > 0 && (
        <ul
          className="mt-3 space-y-1.5"
          aria-label="Changes without code preview"
        >
          {omitted.map((item) => (
            <li
              key={item.path}
              className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted/25 px-3 py-2 text-xs"
            >
              {control(item)}
              <span className="truncate font-mono font-medium">
                {item.path}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {item.status} · {omissionReason(item, patchOf(item), failed)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function omissionReason(
  item: BranchChangeItem,
  content: DiffContent | undefined,
  failed: boolean,
) {
  if (item.oldMode === '160000' || item.newMode === '160000')
    return 'Submodule change';
  if (content === undefined)
    return failed ? 'The patch could not be read' : 'Reading the patch';
  if (content.kind === 'binary') return 'Binary change';
  if (content.kind === 'omitted')
    return content.reason === 'size-limit'
      ? 'Too large to show'
      : 'Cannot be shown';
  return 'No code change';
}
