import { CheckIcon, FileTextIcon, LayersIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { DocumentRef } from '../../domain/documents';
import { entryKey } from '../../domain/documents';
import { basename, changePath, type ReviewScope } from '../../domain/review';
import { useArtifacts, useChanges } from '../../query/review';
import { ReviewEmpty } from './review-empty';

const rowClass =
  'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors hover:bg-accent';

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
  const paths = [...new Set(status.changes.map(changePath))];
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
      <button
        type="button"
        aria-pressed={active({ kind: 'handoff' })}
        className={cn(
          rowClass,
          'flex-col items-stretch gap-2 py-2',
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
        <Progress value={0} aria-label="Review progress" />
      </button>

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
              <span className="grid size-5 shrink-0 place-items-center rounded bg-muted text-[10px] text-muted-foreground">
                {index + 1}
              </span>
              <LayersIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">
                {layer.title}
              </span>
              <Badge variant="secondary">{layerPaths.length}</Badge>
            </button>
            {layerPaths.map((path) => (
              <ChangeRow
                key={path}
                path={path}
                scopes={scopesByPath.get(path) ?? []}
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
              name: artifact.name,
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
  active,
  onOpen,
  indented = false,
}: {
  path: string;
  scopes: readonly string[];
  active: boolean;
  onOpen: (ref: DocumentRef) => void;
  indented?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={path}
      className={cn(
        rowClass,
        'text-muted-foreground',
        indented && 'pl-8',
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
      <span className="min-w-0 flex-1 truncate">{basename(path)}</span>
      <span className="shrink-0 text-[10.5px] text-muted-foreground">
        {scopes.join(' + ')}
      </span>
      <span className="max-w-28 truncate text-[10.5px] text-muted-foreground">
        {path}
      </span>
    </button>
  );
}
