import type { ComponentProps, ReactNode } from 'react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { GitBranchIcon, MessageSquareIcon } from 'lucide-react';
import {
  commentCountsByPath,
  commentsAt,
} from '@porcelain/client/comments/rules';
import { useComments } from '@/features/comments/index';
import { basename, type ReviewScope } from '@porcelain/client/changes/rules';
import {
  plainText,
  reviewCodeIn,
  reviewCodeSections,
  type WalkthroughContent,
  type WalkthroughStop,
} from '@porcelain/client/walkthroughs/rules';
import { useBranchChanges, useChanges } from '@/features/changes/index';
import { FileTreeIcon } from '@/features/files/index';
import { cn } from '@/shared/lib/utils';
import {
  ALL_CHANGES,
  entryKey,
  ReviewIndex,
  ROW,
  SidebarDocumentRow,
  type BranchFileGrouping,
  type ChangeGrouping,
  type OpenDocument,
  type ReviewIndexProps,
  type UncommittedFileGrouping,
} from '@/features/workspace/index';
import { TruncatedText } from '@/shared/views/truncated-text';
import { isSpecPath } from '@porcelain/client/changes/rules';
import { useSpecsApart } from '@/features/preferences/index';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { useWalkthroughContent } from '../queries/walkthrough';
import { useBranchFileSizes } from './cited-files';
import { FileChangeSize } from './walkthrough-blocks';

type BranchSlot = ComponentProps<BranchFileGrouping>;
type UncommittedSlot = ComponentProps<UncommittedFileGrouping>;

function useStepComments(scope: ReviewScope, context: ConnectionContext) {
  const { view } = useComments({ scope, context });
  const byPath = commentCountsByPath(view);
  return (stop: WalkthroughStop, paths: readonly string[]) => {
    const title = plainText(stop.title);
    return (
      paths.reduce((sum, path) => sum + (byPath.get(path) ?? 0), 0) +
      commentsAt(
        view,
        (anchor) =>
          (anchor.kind === 'step' || anchor.kind === 'node') &&
          anchor.title === title,
      ).length
    );
  };
}

type StepRows<File> = {
  stop: WalkthroughStop;
  step: number;
  files: readonly File[];
  elsewhere: readonly string[];
  paths: readonly string[];
};

function ElsewhereRow({
  path,
  where,
  onOpen,
}: {
  path: string;
  where: 'branch' | 'worktree';
  onOpen: OpenDocument;
}) {
  const place = where === 'worktree' ? 'Uncommitted' : 'Committed';
  const other = where === 'worktree' ? 'Uncommitted' : 'Branch';
  return (
    <button
      type="button"
      title={`${path}\n${place}: listed under ${other}, not in this list`}
      aria-label={`${basename(path)} · ${place}, listed under ${other}`}
      onClick={() =>
        onOpen(
          where === 'worktree'
            ? { kind: 'change', path }
            : { kind: 'branch-file', path },
        )
      }
      className={cn(ROW, 'text-muted-foreground')}
    >
      <span className="w-3.5 shrink-0" />
      <FileTreeIcon path={path} className="size-3.5 shrink-0 opacity-60" />
      <TruncatedText className="min-w-0 flex-1" text={basename(path)} />
      <span className="shrink-0 text-2xs">{place}</span>
    </button>
  );
}

function StepList<File>({
  steps,
  activeEntry,
  onOpen,
  row,
  comments,
  elsewhere,
}: {
  steps: readonly StepRows<File>[];
  activeEntry: string | undefined;
  onOpen: OpenDocument;
  row: (file: File) => ReactNode;
  comments: (stop: WalkthroughStop, paths: readonly string[]) => number;
  elsewhere: 'branch' | 'worktree';
}) {
  if (steps.length === 0) return null;
  return (
    <div className="mt-1 flex flex-col">
      <p className="flex px-2 pt-2 pb-1 text-2xs text-muted-foreground">
        <span>By step</span>
        <span className="ml-auto">Files</span>
      </p>
      {steps.map((entry) => {
        const { stop, step, files } = entry;
        const commented = comments(stop, entry.paths);
        const count = files.length + entry.elsewhere.length;
        const document = { kind: 'walkthrough-step', step } as const;
        const active = activeEntry === entryKey(document);
        return (
          <div
            key={step}
            role="group"
            aria-label={`Step ${step}`}
            className="flex flex-col"
          >
            <SidebarDocumentRow
              plain
              label={`Step ${step}`}
              active={active}
              onOpen={() => onOpen(document)}
            >
              <span className="w-3.5 shrink-0 text-center font-mono text-2xs text-muted-foreground">
                {step}
              </span>
              <TruncatedText
                className="min-w-0 flex-1"
                text={plainText(stop.title)}
              />
              {stop.callouts.length > 0 && (
                <span
                  role="img"
                  aria-label="Your call"
                  className="shrink-0 text-2xs font-medium text-warn"
                >
                  Call
                </span>
              )}
              {commented > 0 && (
                <span
                  aria-label={
                    commented === 1 ? '1 comment' : `${commented} comments`
                  }
                  className="flex shrink-0 items-center gap-0.5 text-2xs text-muted-foreground tabular-nums"
                >
                  <MessageSquareIcon aria-hidden className="size-3" />
                  {commented}
                </span>
              )}
              <span
                aria-label={count === 1 ? '1 file' : `${count} files`}
                className="ml-auto text-2xs text-muted-foreground tabular-nums"
              >
                {count}
              </span>
            </SidebarDocumentRow>
            <div className="pl-3">
              {files.map(row)}
              {entry.elsewhere.map((path) => (
                <ElsewhereRow
                  key={path}
                  path={path}
                  where={elsewhere}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function stepRows<File>(
  content: WalkthroughContent,
  sections: ReturnType<typeof reviewCodeSections>,
  side: 'branch' | 'worktree',
  files: readonly File[],
  pathOf: (file: File) => string,
): StepRows<File>[] {
  return content.stops.flatMap((stop, index) => {
    const code = sections.steps[index];
    if (code === undefined) return [];
    const { here, elsewhere } = reviewCodeIn(code, side);
    const listed = files.filter((file) => here.includes(pathOf(file)));
    return listed.length === 0
      ? []
      : [
          {
            stop,
            step: index + 1,
            files: listed,
            elsewhere,
            paths: [...listed.map(pathOf), ...elsewhere],
          },
        ];
  });
}

function NotInWalkthrough<File extends { path: string }>({
  files,
  row,
  context,
}: {
  files: readonly File[];
  row: (file: File) => ReactNode;
  context: ConnectionContext;
}) {
  const specsApart = useSpecsApart(context.connection);
  const specs = specsApart ? files.filter((file) => isSpecPath(file.path)) : [];
  const others = specsApart
    ? files.filter((file) => !isSpecPath(file.path))
    : files;
  return (
    <>
      {others.length > 0 && (
        <div
          role="group"
          aria-label="Not in the walkthrough yet"
          className="mt-1 flex flex-col"
        >
          <p className="px-2 pt-2 pb-1 text-2xs text-muted-foreground">
            Not in the walkthrough yet
          </p>
          {others.map(row)}
        </div>
      )}
      {specs.length > 0 && (
        <div role="group" aria-label="Specs" className="mt-1 flex flex-col">
          <p className="px-2 pt-2 pb-1 text-2xs text-muted-foreground">Specs</p>
          {specs.map(row)}
        </div>
      )}
    </>
  );
}

function BranchSteps({
  scope,
  context,
  base,
  items,
  row,
  activeEntry,
  onOpen,
}: BranchSlot) {
  const ready = useWalkthroughContent(scope, context);
  const comments = useStepComments(scope, context);
  const worktree = useChanges(scope, context.connection);
  const sections = reviewCodeSections({
    content: ready?.content,
    branch: items,
    worktree: worktree.changes,
  });
  const size = useBranchFileSizes(
    scope,
    context.connection,
    base,
    sections.steps.flatMap((code) => code.branch),
  );
  if (!ready || ready.content.stops.length === 0)
    return <>{items.map((item) => row(item))}</>;
  const steps = stepRows(
    ready.content,
    sections,
    'branch',
    items,
    (item) => item.path,
  );
  const outside = new Set(sections.outside.branch);
  return (
    <>
      <StepList
        steps={steps}
        activeEntry={activeEntry}
        onOpen={onOpen}
        row={(item) => {
          const counts = size(item.path);
          return row(item, {
            tick: true,
            trailing: counts && <FileChangeSize size={counts} />,
          });
        }}
        comments={comments}
        elsewhere="worktree"
      />
      <NotInWalkthrough
        files={items.filter((item) => outside.has(item.path))}
        row={(item) => row(item, { tick: true })}
        context={context}
      />
    </>
  );
}

function UncommittedSteps({
  scope,
  context,
  base,
  paths,
  row,
  activeEntry,
  onOpen,
}: UncommittedSlot) {
  const ready = useWalkthroughContent(scope, context);
  const branchResult = useBranchChanges(scope, context.connection, base).result;
  const branch = Option.getOrUndefined(AsyncResult.value(branchResult));
  const worktree = useChanges(scope, context.connection);
  const comments = useStepComments(scope, context);
  if (paths.length === 0)
    return (
      <p className="p-3 text-sm text-muted-foreground">
        {ready ? 'Nothing uncommitted.' : 'No changes'}
      </p>
    );
  const allChanges = (
    <SidebarDocumentRow
      plain
      label="All changes"
      active={activeEntry === entryKey(ALL_CHANGES)}
      onOpen={() => onOpen(ALL_CHANGES)}
    >
      <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">All changes</span>
      <span className="ml-auto text-2xs text-muted-foreground tabular-nums">
        {paths.length}
      </span>
    </SidebarDocumentRow>
  );
  if (!ready || ready.content.stops.length === 0)
    return (
      <div className="flex flex-col">
        {allChanges}
        {paths.map((path) => row(path))}
      </div>
    );
  const sections = reviewCodeSections({
    content: ready.content,
    branch: branch?.files ?? [],
    worktree: worktree.changes.filter((change) => paths.includes(change.path)),
  });
  const steps = stepRows(
    ready.content,
    sections,
    'worktree',
    paths,
    (path) => path,
  );
  const outside = new Set(sections.outside.worktree);
  return (
    <div className="flex flex-col">
      {allChanges}
      <StepList
        steps={steps}
        activeEntry={activeEntry}
        onOpen={onOpen}
        row={(path) => row(path, { tick: true })}
        comments={comments}
        elsewhere="branch"
      />
      <NotInWalkthrough
        files={paths
          .filter((path) => outside.has(path))
          .map((path) => ({ path }))}
        row={(file) => row(file.path, { tick: true })}
        context={context}
      />
    </div>
  );
}

const STEP_GROUPING: ChangeGrouping = {
  branch: BranchSteps,
  uncommitted: UncommittedSteps,
};

export function WalkthroughIndex(props: ReviewIndexProps) {
  return <ReviewIndex {...props} grouping={STEP_GROUPING} />;
}
