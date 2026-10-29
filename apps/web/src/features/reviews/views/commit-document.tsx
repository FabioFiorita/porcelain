import { TruncatedText } from '@/shared/views/truncated-text';
import { commitPath, commitPaths } from '@porcelain/client/history/rules';
import { ordinal, useCommit } from '@/features/history/index';
import {
  diffUnavailableReason,
  isSubmoduleChange,
} from '@porcelain/client/changes/rules';
import { relativeTime } from '@/shared/lib/relative-time';
import { BarAction } from '@/shared/workspace/bar-action';
import {
  CopyIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  UserRoundIcon,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { Option } from 'effect';
import { useAtomValue } from '@effect/atom-react';
import { readHistoryWindow } from '@porcelain/client/history';
import { AsyncResult } from 'effect/reactivity';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { DIFF_WINDOW_FILES } from '@/config/limits';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { commitEntry, useCommitDiffs } from '@/features/changes/index';
import { copyText } from '@/shared/workspace/copy';
import {
  commitMessage,
  type CommitFile,
  type CommitFiles,
} from '@porcelain/client/history/rules';
import { refLabel, shortOid, shownRefs } from '@porcelain/client/history/rules';
import type { DocumentInteraction, OpenDocument } from '../rules/documents';
import type { DiffContent, ReviewScope } from '@porcelain/client/reviews/rules';
import { CodeDocument } from './code-document';
import { ReadMoreFiles } from './read-more-files';
import { type ConnectionContext } from '@/shared/workspace/connection';

const pathKey = (file: CommitFile) => commitPaths(file).join('\0');

export function CommitDocument({
  scope,
  context,
  interaction,
  oid,
  onOpen,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  interaction: DocumentInteraction;
  oid: string;
  onOpen: OpenDocument;
}) {
  const { connection } = context;
  const { reveal } = interaction;
  const requestedParent =
    reveal?.anchor.comparison?.kind === 'commit'
      ? reveal.anchor.comparison.parent
      : 1;
  const [parentChoice, setParentChoice] = useState({
    nonce: reveal?.nonce,
    parent: requestedParent,
  });
  const parent =
    parentChoice.nonce === reveal?.nonce
      ? parentChoice.parent
      : requestedParent;
  const [, startTransition] = useTransition();
  const commit = useCommit(connection, scope, oid, parent);
  const history = Option.getOrUndefined(
    AsyncResult.value(useAtomValue(readHistoryWindow({ connection, scope }))),
  );
  const branch =
    history?.snapshot?.head.kind === 'attached' &&
    history.commits.some((entry) => entry.oid === oid)
      ? refLabel(history.snapshot.head.ref)
      : undefined;
  const [window, setWindow] = useState({
    of: `${oid}:${parent}`,
    shown: DIFF_WINDOW_FILES,
  });
  const shown =
    window.of === `${oid}:${parent}` ? window.shown : DIFF_WINDOW_FILES;
  const readMore = () =>
    setWindow({ of: `${oid}:${parent}`, shown: shown + DIFF_WINDOW_FILES });
  const reached = commit.files.slice(0, shown);
  const wanted = reached.map((file) => commitPaths(file));
  const diffs = useCommitDiffs(connection, scope, oid, parent, wanted);
  const patchOf = (file: CommitFile) => diffs.patches.get(pathKey(file));
  const entries = reached.flatMap((file) => {
    const entry = commitEntry(oid, file, patchOf(file));
    return entry === null || entry === undefined
      ? []
      : [
          {
            ...entry,
            id: `${entry.id}:${parent}`,
            comment: {
              filePath: entry.path,
              revision: oid,
              comparison: { kind: 'commit' as const, parent },
            },
          },
        ];
  });
  const omitted = reached.filter(
    (file) => (commitEntry(oid, file, patchOf(file)) ?? null) === null,
  );
  const more = commit.files.length - reached.length;
  const subject = commit.commit.subject || `Commit ${shortOid(oid)}`;
  const counts = new Map(
    entries.map((entry) => [
      entry.path,
      entry.fileDiff.hunks.reduce(
        (sum, hunk) => ({
          added: sum.added + hunk.additionLines,
          removed: sum.removed + hunk.deletionLines,
        }),
        { added: 0, removed: 0 },
      ),
    ]),
  );
  for (const file of reached)
    if (patchOf(file)?.kind === 'metadata-only')
      counts.set(commitPath(file), { added: 0, removed: 0 });
  const complete =
    more === 0 &&
    commit.files.every((file) => {
      const content = patchOf(file);
      return counts.has(commitPath(file)) || content?.kind === 'binary';
    });
  const total = complete
    ? [...counts.values()].reduce(
        (sum, count) => ({
          added: sum.added + count.added,
          removed: sum.removed + count.removed,
        }),
        { added: 0, removed: 0 },
      )
    : undefined;
  const barActions = (
    <>
      <BarAction
        label="Copy hash"
        icon={CopyIcon}
        onClick={() => copyText(oid, 'commit id')}
      />
      <BarAction
        label="Open in graph"
        icon={GitBranchIcon}
        onClick={() => onOpen({ kind: 'graph' })}
      />
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CodeDocument
        toolbar={(collapseControl) => (
          <header className="mx-auto w-full max-w-commit px-7 pt-10">
            {interaction.toolbarTarget ? (
              createPortal(barActions, interaction.toolbarTarget)
            ) : (
              <div className="flex flex-wrap gap-1">{barActions}</div>
            )}
            <div className="flex min-h-5.5 min-w-0 flex-wrap items-center gap-x-2 text-ui leading-5.5 font-medium text-muted-foreground">
              <GitCommitHorizontalIcon className="size-3.5 shrink-0" />
              <span>
                Commit{' '}
                <TruncatedText
                  text={oid}
                  disclose="always"
                  className="font-mono text-caption text-foreground"
                >
                  {shortOid(oid)}
                </TruncatedText>
              </span>
              {branch && (
                <span className="flex min-w-0 items-center gap-1">
                  on{' '}
                  <TruncatedText
                    text={branch}
                    className="font-mono text-caption font-normal"
                  />
                </span>
              )}
            </div>
            <TruncatedText
              text={subject}
              render={<h1 />}
              className="mt-3 text-2xl leading-tight font-semibold tracking-tight"
            />
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {commit.commit.parentOids.length > 1 && (
                <Tabs
                  value={String(parent)}
                  onValueChange={(value) =>
                    startTransition(() =>
                      setParentChoice({
                        nonce: reveal?.nonce,
                        parent: Number(value),
                      }),
                    )
                  }
                >
                  <TabsList>
                    {commit.commit.parentOids.map((parentOid, index) => (
                      <TabsTrigger key={parentOid} value={String(index + 1)}>
                        {ordinal(index + 1)} parent ·{' '}
                        <span className="font-mono">{shortOid(parentOid)}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}
              <BarAction
                label="Copy message"
                icon={CopyIcon}
                onClick={() =>
                  copyText(commitMessage(commit.commit), 'commit message')
                }
              />
              {collapseControl}
            </div>
          </header>
        )}
        framed
        scope={scope}
        context={context}
        interaction={interaction}
        entries={entries}
        header={() => (
          <>
            <CommitHeader
              commit={commit}
              branch={branch}
              counts={counts}
              total={total}
              omitted={omitted}
              patchOf={patchOf}
              failed={diffs.failed}
              onRetry={diffs.retry}
            />
          </>
        )}
      />
      <ReadMoreFiles
        more={more}
        pending={diffs.pending}
        onReadMore={readMore}
      />
    </div>
  );
}

function CommitHeader({
  commit,
  omitted,
  patchOf,
  failed,
  onRetry,
  branch,
  counts,
  total,
}: {
  branch: string | undefined;
  counts: ReadonlyMap<string, { added: number; removed: number }>;
  total: { added: number; removed: number } | undefined;
  commit: CommitFiles;
  omitted: readonly CommitFile[];
  patchOf: (file: CommitFile) => DiffContent | undefined;
  failed: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="mx-auto mt-1 mb-6 w-full max-w-commit min-w-0 px-7">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-ui leading-5 text-muted-foreground">
        <span
          aria-hidden="true"
          className="grid size-5 shrink-0 place-items-center rounded-sm border border-border-strong text-foreground"
        >
          <UserRoundIcon className="size-3" />
        </span>
        <TruncatedText
          text={commit.commit.author.name}
          className="font-medium text-foreground"
        />
        <span aria-hidden="true">·</span>
        <span>{relativeTime(commit.commit.author.timestamp)}</span>
        {commit.comparison.kind === 'parent' ? (
          <span>
            <span aria-hidden="true">· </span>parent{' '}
            <span className="font-mono text-caption leading-5 text-foreground">
              {shortOid(commit.comparison.baseOid)}
            </span>
            {commit.commit.parentOids.length > 1 &&
              ` (${ordinal(commit.comparison.parentNumber)} parent of a merge)`}
          </span>
        ) : (
          <span>root commit</span>
        )}
      </div>
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
        {shownRefs(commit.commit.refs)
          .filter((ref) => ref !== branch)
          .map((ref) => (
            <TruncatedText key={ref} text={ref} className="font-mono" />
          ))}
      </div>
      {commit.commit.body !== null && commit.commit.body !== undefined && (
        <p className="mt-3 whitespace-pre-wrap text-ui leading-relaxed wrap-anywhere text-muted-foreground">
          {commit.commit.body}
        </p>
      )}
      {(commit.commit.subjectTruncated || commit.commit.bodyTruncated) && (
        <p className="mt-1 text-caption text-muted-foreground">
          Commit message truncated
        </p>
      )}
      <section aria-label="Files changed" className="mt-7">
        <p className="border-b pb-1.5 text-xs font-medium tabular-nums">
          <span>
            {commit.files.length} file{commit.files.length === 1 ? '' : 's'}{' '}
            changed
          </span>
          {total && (
            <>
              <span className="mx-2 font-normal text-muted-foreground">·</span>
              <LineCounts count={total} />
            </>
          )}
          {!total && commit.files.length > 0 && (
            <span className="ml-2 font-normal text-muted-foreground">
              {failed ? 'Line counts unavailable' : 'Line counts incomplete'}
            </span>
          )}
        </p>
        <ul
          className="max-h-64 divide-y overflow-y-auto border-b"
          aria-label="Changed files"
        >
          {commit.files.map((file) => (
            <li
              key={pathKey(file)}
              className="flex h-8 min-w-0 items-center gap-2.5 rounded-sm pr-1.5 pl-1 text-caption leading-4"
            >
              <span
                aria-label={file.status}
                className="w-4 shrink-0 text-center font-mono text-xs font-semibold text-brand"
              >
                {file.status.slice(0, 1).toUpperCase()}
              </span>
              <TruncatedText
                text={commitPaths(file).join(' → ')}
                className="flex-1 font-mono font-medium"
              />
              <LineCounts count={counts.get(commitPath(file))} />
              {patchOf(file)?.kind === 'binary' && (
                <span className="text-xs text-muted-foreground">Binary</span>
              )}
            </li>
          ))}
        </ul>
      </section>
      {omitted.length > 0 && (
        <OmittedCommitChanges
          changes={omitted}
          patchOf={patchOf}
          failed={failed}
          onRetry={onRetry}
        />
      )}
    </section>
  );
}

function OmittedCommitChanges({
  changes,
  patchOf,
  failed,
  onRetry,
}: {
  changes: readonly CommitFile[];
  patchOf: (file: CommitFile) => DiffContent | undefined;
  failed: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      {failed && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          Some patches could not be read.
          <Button size="xs" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </p>
      )}
      <ul
        className="mt-3 space-y-1.5"
        aria-label="Changes without code preview"
      >
        {changes.map((change) => {
          const path = commitPath(change);
          const content = patchOf(change);
          const submodule = isSubmoduleChange(change);
          const reason =
            diffUnavailableReason(change, content, failed) ?? 'No code change';
          return (
            <li
              key={`${change.oldPath}->${change.newPath}:${change.status}`}
              className="rounded-lg border bg-muted/25 px-3 py-2 text-xs"
            >
              <div className="flex min-w-0 items-center gap-2">
                <TruncatedText className="font-mono font-medium" text={path} />
                <span className="shrink-0 text-muted-foreground">
                  {change.status} · {reason}
                </span>
              </div>
              {submodule && content?.kind === 'text' && (
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-2xs text-muted-foreground">
                  {content.patch
                    .split('\n')
                    .filter((line) => /^[+-]Subproject commit /.test(line))
                    .map((line) => line.slice(1))
                    .join('\n')}
                </pre>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function LineCounts({
  count,
}: {
  count: { added: number; removed: number } | undefined;
}) {
  if (!count) return null;
  return (
    <span className="shrink-0 space-x-1 font-mono text-xs font-medium tabular-nums">
      <span className="text-add-fg">+{count.added}</span>
      <span className="text-del-fg">−{count.removed}</span>
    </span>
  );
}
