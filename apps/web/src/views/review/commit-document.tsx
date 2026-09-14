import { formatDistanceToNowStrict } from 'date-fns';
import { CopyIcon } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { historyRefLabel, ordinal } from '../../domain/history';
import type { CommitChanges, ReviewScope } from '../../domain/review';
import { shortOid } from '../../domain/review';
import { useHistory } from '../../query/history';
import { useCommit, useCommitLayers } from '../../query/review';
import { copyText } from '../workspace/copy';
import { CodeDocument } from './code-document';
import { commitEntry } from './diff-entries';
import { useDocumentInteraction } from './document-interaction';
import { DocumentToolbar } from './document-toolbar';
import { MarkdownView } from './markdown-view';

export function CommitDocument({
  scope,
  oid,
}: {
  scope: ReviewScope;
  oid: string;
}) {
  // A merge can be read against any of its parents; all other commits only
  // have the first parent (or the empty tree for a root commit).
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
  const archived = useCommitLayers(scope, oid);
  const history = useHistory(scope);
  const entries = useMemo(
    () =>
      commit.changes.flatMap((change) => {
        const entry = commitEntry(oid, change);
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
    [commit, oid, parent],
  );
  const omitted = useMemo(
    () => commit.changes.filter((change) => commitEntry(oid, change) == null),
    [commit, oid],
  );
  const historyEntry = history.commits.find((item) => item.oid === oid);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CodeDocument
        toolbar={(collapseControl) => (
          <DocumentToolbar
            title={<span className="font-mono">{shortOid(oid)}</span>}
            subtitle={`${commit.changes.length} file${commit.changes.length === 1 ? '' : 's'} changed`}
          >
            {commit.parentOids.length > 1 && (
              // Keep the current diff visible while the other parent is loading.
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
                  {commit.parentOids.map((parentOid, index) => (
                    <TabsTrigger
                      key={parentOid}
                      value={String(index + 1)}
                      className="px-2 text-xs"
                    >
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
              historyEntry={historyEntry}
              oid={oid}
              omitted={omitted}
            />
            {archived && (
              <section
                aria-label="Archived review notes"
                className="mx-4 mb-4 space-y-3 rounded-xl border p-4"
              >
                <h2 className="text-sm font-semibold">Review notes</h2>
                {archived.parentNumber !== parent && (
                  <p className="text-xs text-muted-foreground">
                    These notes describe the comparison against parent{' '}
                    {archived.parentNumber}.
                  </p>
                )}
                {archived.layers.map((layer) => (
                  <div key={layer.id} className="space-y-2">
                    <h3 className="text-sm font-medium">{layer.title}</h3>
                    {layer.summary && (
                      <MarkdownView
                        text={layer.summary}
                        className="text-sm text-muted-foreground"
                      />
                    )}
                    {layer.files.map((file) => (
                      <div
                        key={`${file.scope}:${file.path}`}
                        className="text-xs"
                      >
                        <p className="font-mono">
                          {file.path}{' '}
                          <span className="font-sans text-muted-foreground">
                            · {file.scope} at review
                          </span>
                        </p>
                        {file.note && (
                          <MarkdownView
                            text={file.note}
                            className="mt-1 text-muted-foreground"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      />
    </div>
  );
}

function CommitHeader({
  commit,
  historyEntry,
  oid,
  omitted,
}: {
  commit: CommitChanges;
  historyEntry?: ReturnType<typeof useHistory>['commits'][number] | undefined;
  oid: string;
  omitted: readonly CommitChanges['changes'][number][];
}) {
  return (
    <section className="mx-4 mt-3 rounded-xl border px-4 py-3">
      <h2 className="text-sm font-semibold">
        {historyEntry?.subject ?? 'Commit'}
      </h2>
      {historyEntry?.body != null && (
        <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-muted-foreground">
          {historyEntry.body}
        </p>
      )}
      {historyEntry?.bodyTruncated && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Commit message truncated
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
        {historyEntry != null && (
          <span>
            {historyEntry.author.name} ·{' '}
            {formatDistanceToNowStrict(
              new Date(historyEntry.author.timestamp),
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
            {commit.parentOids.length > 1 &&
              ` (${ordinal(commit.comparison.parentNumber)} parent of a merge)`}
          </span>
        ) : (
          <span>root commit</span>
        )}
        {historyEntry?.refs.map((ref) => (
          <Badge
            key={ref}
            title={ref}
            variant="secondary"
            className="h-4 px-1.5 text-[10px] font-normal"
          >
            {historyRefLabel(ref)}
          </Badge>
        ))}
      </div>
      {omitted.length > 0 && <OmittedCommitChanges changes={omitted} />}
    </section>
  );
}

function OmittedCommitChanges({
  changes,
}: {
  changes: readonly CommitChanges['changes'][number][];
}) {
  return (
    <ul className="mt-3 space-y-1.5" aria-label="Changes without code preview">
      {changes.map((change) => {
        const path = change.newPath ?? change.oldPath ?? 'Unknown path';
        const reason =
          change.patch.kind === 'binary'
            ? 'Binary change'
            : change.patch.kind === 'submodule'
              ? 'Submodule change'
              : 'Patch could not be displayed';
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
            {change.patch.kind === 'submodule' && (
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
                {change.patch.text}
              </pre>
            )}
          </li>
        );
      })}
    </ul>
  );
}
