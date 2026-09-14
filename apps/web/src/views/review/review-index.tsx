import { CheckIcon, FileTextIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { DocumentRef } from '../../domain/documents';
import { entryKey } from '../../domain/documents';
import {
  basename,
  changePath,
  type ReviewScope,
  type ReviewStatus,
} from '../../domain/review';
import {
  useArtifacts,
  useChanges,
  useReviewEvidence,
} from '../../query/review';
import { FileTypeIcon } from './file-type-icon';
import { ReviewEmpty } from './review-empty';
import { MarkAllReviewed } from './reviewed-control';

const rowClass =
  'flex w-full min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[12.5px] transition-colors hover:bg-accent';

export function ReviewIndex({
  scope,
  activeEntry,
  onOpen,
}: {
  scope: ReviewScope;
  activeEntry: string | undefined;
  onOpen: (ref: DocumentRef) => void;
}) {
  const { status, layers } = useChanges(scope);
  const artifacts = useArtifacts(scope);
  const evidence = useReviewEvidence(scope);
  const paths = [...new Set(status.changes.map(changePath))];
  const evidenceByPath = new Map(evidence.map((entry) => [entry.path, entry]));
  const reviewedCount = evidence.filter(
    (entry) => entry.reviewStatus === 'reviewed',
  ).length;
  const progress =
    evidence.length === 0 ? 0 : (reviewedCount / evidence.length) * 100;
  const scopesByPath = new Map<string, string[]>();
  for (const change of status.changes) {
    const scopes = scopesByPath.get(changePath(change)) ?? [];
    if (!scopes.includes(change.scope)) scopes.push(change.scope);
    scopesByPath.set(changePath(change), scopes);
  }
  const isReview = layers.layers.length > 0;
  const active = (ref: DocumentRef) => activeEntry === entryKey(ref);
  if (paths.length === 0 && !isReview && artifacts.length === 0)
    return (
      <ReviewEmpty
        title="No changes"
        description="This worktree matches its last commit."
      />
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2 [--radius:var(--radius-xl)]">
      <div className="flex min-w-0 items-start gap-1">
        <button
          type="button"
          aria-pressed={active({ kind: 'handoff' })}
          className={cn(
            rowClass,
            'min-w-0 flex-1 flex-col items-stretch gap-2 py-2',
            active({ kind: 'handoff' }) &&
              'workspace-choice bg-accent font-medium text-foreground',
          )}
          onClick={() => onOpen({ kind: 'handoff' })}
        >
          <span className="flex items-center gap-2 font-medium">
            {isReview ? 'The whole handoff' : 'All changes'}
            <span className="ml-auto text-[11px] font-normal text-muted-foreground">
              {paths.length} {paths.length === 1 ? 'file' : 'files'}
            </span>
          </span>
          <Progress
            value={progress}
            aria-label={`${reviewedCount} of ${evidence.length} files reviewed`}
          />
          <span className="text-left text-[11px] font-normal text-muted-foreground">
            {reviewedCount} of {evidence.length} reviewed
          </span>
        </button>
        <MarkAllReviewed scope={scope} entries={evidence} compact />
      </div>

      {layers.layers.map((layer, index) => {
        const ref: DocumentRef = { kind: 'layer', layerId: layer.id };
        const layerPaths = [...new Set(layer.files.map((file) => file.path))];
        return (
          <section key={layer.id} className="flex flex-col gap-0.5">
            <button
              type="button"
              aria-pressed={active(ref)}
              className={cn(
                rowClass,
                active(ref) &&
                  'workspace-choice bg-accent font-medium text-foreground',
              )}
              onClick={() => onOpen(ref)}
            >
              <span className="grid size-4.5 shrink-0 place-items-center rounded bg-muted text-[10px] text-muted-foreground">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {layer.title}
              </span>
              <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
                {layerPaths.length}
              </span>
            </button>
            {layerPaths.map((path) => (
              <ChangeRow
                key={path}
                path={path}
                scopes={scopesByPath.get(path) ?? []}
                reviewStatus={evidenceByPath.get(path)?.reviewStatus}
                active={active({ kind: 'change', path })}
                onOpen={onOpen}
                indented
              />
            ))}
          </section>
        );
      })}

      {paths
        .filter(
          (path) =>
            !layers.layers.some((layer) =>
              layer.files.some((file) => file.path === path),
            ),
        )
        .map((path) => (
          <ChangeRow
            key={path}
            path={path}
            scopes={scopesByPath.get(path) ?? []}
            reviewStatus={evidenceByPath.get(path)?.reviewStatus}
            active={active({ kind: 'change', path })}
            onOpen={onOpen}
          />
        ))}

      {artifacts.length > 0 && (
        <section className="flex flex-col gap-0.5 border-t pt-2">
          <p className="px-2 py-1 text-xs text-muted-foreground">
            From the agent
          </p>
          {artifacts.map((artifact) => {
            const ref: DocumentRef = {
              kind: 'artifact',
              artifactId: artifact.id,
            };
            return (
              <button
                key={artifact.id}
                type="button"
                className={cn(rowClass, active(ref) && 'bg-accent')}
                onClick={() => onOpen(ref)}
              >
                <FileTextIcon />
                <span className="min-w-0 flex-1 truncate">{artifact.name}</span>
                <span className="text-[10.5px] text-muted-foreground">
                  {artifact.sizeBytes.toLocaleString()} bytes
                </span>
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
}

function ChangeRow({
  path,
  scopes,
  reviewStatus,
  active,
  onOpen,
  indented = false,
}: {
  path: string;
  scopes: readonly string[];
  reviewStatus: ReviewStatus | undefined;
  active: boolean;
  onOpen: (ref: DocumentRef) => void;
  indented?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${basename(path)}${scopes.length > 0 ? ` · ${scopes.join(' + ')}` : ''}`}
      title={path}
      className={cn(
        rowClass,
        'text-muted-foreground',
        indented && 'pl-6',
        active && 'workspace-choice bg-accent font-medium text-foreground',
      )}
      onClick={() => onOpen({ kind: 'change', path })}
    >
      <span className="grid w-3.5 shrink-0 place-items-center">
        {active ? (
          <CheckIcon className="size-3.5" />
        ) : (
          <span className="size-1.5 rounded-full bg-foreground" />
        )}
      </span>
      <span
        aria-hidden="true"
        data-review-state={reviewStatus ?? 'unreviewed'}
        title={reviewStatusLabel(reviewStatus)}
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          reviewStatus === 'reviewed'
            ? 'bg-emerald-500'
            : reviewStatus === 'stale'
              ? 'bg-amber-500'
              : 'bg-muted-foreground/50',
        )}
      />
      <FileTypeIcon path={path} className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{basename(path)}</span>
    </button>
  );
}

function reviewStatusLabel(status: ReviewStatus | undefined) {
  if (status === 'reviewed') return 'Reviewed';
  if (status === 'stale') return 'Changed since review';
  return 'Not reviewed';
}
