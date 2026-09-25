import { formatDistanceToNowStrict } from 'date-fns';
import { CopyIcon } from 'lucide-react';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { historyRefLabel, ordinal } from '@/features/review/model/history';
import type {
  CommitFile,
  CommitFiles,
  DiffContent,
  ReviewScope,
} from '@/features/review/model/review';
import { shortOid } from '@/features/review/model/review';
import { useCommit, useCommitDiffs } from '@/features/review/queries/review';
import { copyText } from '@/shared/workspace/copy';
import { CodeDocument } from './code-document';
import { commitEntry } from './diff-entries';
import { useDocumentInteraction } from './document-interaction';
import { DocumentToolbar } from './document-toolbar';

const SHOWN_STEP = 25;

const pathList = (file: CommitFile) => [
  ...new Set([file.oldPath, file.newPath].filter((path) => path != null)),
];
const pathKey = (file: CommitFile) => pathList(file).join('\0');

export function CommitDocument({
  scope,
  oid,
}: {
  scope: ReviewScope;
  oid: string;
}) {
  const { reveal } = useDocumentInteraction();
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
  const commit = useCommit(scope, oid, parent);
  const [window, setWindow] = useState({
    of: `${oid}:${parent}`,
    shown: SHOWN_STEP,
  });
  const shown = window.of === `${oid}:${parent}` ? window.shown : SHOWN_STEP;
  const readMore = () =>
    setWindow({ of: `${oid}:${parent}`, shown: shown + SHOWN_STEP });
  const reached = useMemo(() => commit.files.slice(0, shown), [commit, shown]);
  const wanted = useMemo(
    () => reached.map((file) => pathList(file)),
    [reached],
  );
  const diffs = useCommitDiffs(scope, oid, parent, wanted);
  const patchOf = useCallback(
    (file: CommitFile) => diffs.patches.get(pathKey(file)),
    [diffs.patches],
  );
  const entries = useMemo(
    () =>
      reached.flatMap((file) => {
        const entry = commitEntry(oid, file, patchOf(file));
        return entry == null
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
      }),
    [reached, oid, parent, patchOf],
  );
  const omitted = useMemo(
    () =>
      reached.filter((file) => commitEntry(oid, file, patchOf(file)) == null),
    [reached, oid, patchOf],
  );
  const more = commit.files.length - reached.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CodeDocument
        toolbar={(collapseControl) => (
          <DocumentToolbar
            title={<span className="font-mono">{shortOid(oid)}</span>}
            subtitle={`${commit.files.length} file${commit.files.length === 1 ? '' : 's'} changed`}
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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyText(oid, 'commit id')}
            >
              <CopyIcon className="size-3.5" />
              Copy id
            </Button>
            {collapseControl}
          </DocumentToolbar>
        )}
        scope={scope}
        entries={entries}
        header={() => (
          <>
            <CommitHeader
              commit={commit}
              oid={oid}
              omitted={omitted}
              patchOf={patchOf}
              failed={diffs.isError}
              onRetry={diffs.retry}
            />
          </>
        )}
      />
      {more > 0 && (
        <div className="border-t px-4 py-3 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={readMore}
            disabled={diffs.isPending}
          >
            {diffs.isPending
              ? 'Reading…'
              : `Read ${Math.min(more, SHOWN_STEP)} more of ${more}`}
          </Button>
        </div>
      )}
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
    <section className="mx-4 mt-3 rounded-xl border px-4 py-3">
      <h2 className="text-sm font-semibold">{commit.commit.subject}</h2>
      {commit.commit.body != null && (
        <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-muted-foreground">
          {commit.commit.body}
        </p>
      )}
      {commit.commit.bodyTruncated && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Commit message truncated
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
        {commit.commit != null && (
          <span>
            {commit.commit.author.name} ·{' '}
            {formatDistanceToNowStrict(
              new Date(commit.commit.author.timestamp),
              { addSuffix: true },
            )}
          </span>
        )}
        <span className="font-mono">{oid}</span>
        {commit.comparison.kind === 'parent' ? (
          <span>
            against{' '}
            <span className="font-mono">
              {shortOid(commit.comparison.baseOid)}
            </span>
            {commit.commit.parentOids.length > 1 &&
              ` (${ordinal(commit.comparison.parentNumber)} parent of a merge)`}
          </span>
        ) : (
          <span>root commit</span>
        )}
        {commit.commit.refs.map((ref) => (
          <Badge key={ref} title={ref} variant="secondary" className="h-4">
            {historyRefLabel(ref)}
          </Badge>
        ))}
      </div>
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
          const path = change.newPath ?? change.oldPath ?? 'Unknown path';
          const content = patchOf(change);
          const submodule =
            change.oldMode === '160000' || change.newMode === '160000';
          const reason = submodule
            ? 'Submodule change'
            : content === undefined
              ? failed
                ? 'The patch could not be read'
                : 'Reading the patch'
              : content.kind === 'binary'
                ? 'Binary change'
                : content.kind === 'omitted'
                  ? content.reason === 'size-limit'
                    ? 'Too large to show'
                    : 'Cannot be shown'
                  : 'No code change';
          return (
            <li
              key={`${change.oldPath}->${change.newPath}:${change.status}`}
              className="rounded-lg border bg-muted/25 px-3 py-2 text-xs"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono font-medium">{path}</span>
                <span className="shrink-0 text-muted-foreground">
                  {change.status} · {reason}
                </span>
              </div>
              {submodule && content?.kind === 'text' && (
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
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
