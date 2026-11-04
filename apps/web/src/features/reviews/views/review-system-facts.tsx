import type { ReviewRevision } from '@porcelain/client/reviews/rules';
export function ReviewSystemFacts({ revision }: { revision: ReviewRevision }) {
  const system = revision.content.system;
  if (!system)
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Import map unavailable for this revision. Republish to compute it.
      </p>
    );
  return (
    <div className="mt-2 flex min-w-0 flex-col gap-2 text-xs text-muted-foreground">
      <p>
        Imports at the saved base and head, grouped by package and feature.
        Select a part to open its decision. Agent notes explain the parts.
      </p>
      {system.unresolved > 0 && (
        <p>{system.unresolved} relative imports could not be resolved.</p>
      )}
      {system.guards.length > 0 && (
        <p className="wrap-anywhere">
          Guards added: {system.guards.join(', ')}
        </p>
      )}
    </div>
  );
}
