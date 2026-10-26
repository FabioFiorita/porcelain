import { TruncatedText } from '@/shared/views/truncated-text';
import { commitPath, commitPaths } from '@porcelain/client/history/rules';
import { ordinal, useCommit } from '@/features/history/index';
import {
  diffUnavailableReason,
  isSubmoduleChange,
} from '@porcelain/client/changes/rules';
import { relativeTime } from '@/shared/lib/relative-time';
import { BarAction } from '@/shared/workspace/bar-action';
import { CopyIcon, GitBranchIcon } from 'lucide-react';
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
import { shortOid, shownRefs } from '@porcelain/client/history/rules';
import type { DocumentInteraction, OpenDocument } from '../rules/documents';
import type { DiffContent, ReviewScope } from '@porcelain/client/reviews/rules';
import { CodeDocument } from './code-document';
import { DocumentToolbar } from './document-toolbar';
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CodeDocument
        toolbar={(collapseControl) => (
          <div className="px-3 pt-8">
            <DocumentToolbar
              target={interaction.toolbarTarget}
              barActions={
                <>
                  {' '}
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
              }
              titleLabel={subject}
              title={
                <span className="text-2xl leading-tight font-semibold tracking-tight">
                  {subject}
                </span>
              }
            >
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
                  <TabsList className="h-7">
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
            </DocumentToolbar>
          </div>
        )}
        scope={scope}
        context={context}
        interaction={interaction}
        entries={entries}
        header={() => (
          <>
            <CommitHeader
              commit={commit}
              oid={oid}
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
  oid,
  omitted,
  patchOf,
  failed,
  onRetry,
}: {
  commit: CommitFiles;
  oid: string;
  omitted: readonly CommitFile[];
  patchOf: (file: CommitFile) => DiffContent | undefined;
  failed: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="mx-7 mt-1 mb-6 min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-ui text-muted-foreground">
        <TruncatedText
          text={commit.commit.author.name}
          className="font-medium text-foreground"
        />
        <span>{relativeTime(commit.commit.author.timestamp)}</span>
        {commit.comparison.kind === 'parent' ? (
          <span>
            against{' '}
            <span className="font-mono text-foreground">
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
        <TruncatedText text={oid} className="font-mono" />
        {shownRefs(commit.commit.refs).map((ref) => (
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
          {commit.files.length} file{commit.files.length === 1 ? '' : 's'}{' '}
          changed
        </p>
        <ul
          className="max-h-64 divide-y overflow-y-auto border-b"
          aria-label="Changed files"
        >
          {commit.files.map((file) => (
            <li
              key={pathKey(file)}
              className="flex min-w-0 items-center gap-2.5 py-2 text-caption"
            >
              <span
                aria-label={file.status}
                className="w-4 shrink-0 text-center font-mono font-medium text-muted-foreground"
              >
                {file.status.slice(0, 1).toUpperCase()}
              </span>
              <TruncatedText
                text={commitPaths(file).join(' → ')}
                className="font-mono"
              />
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
