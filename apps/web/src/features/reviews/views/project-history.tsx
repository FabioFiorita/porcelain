import { Link } from '@tanstack/react-router';
import { useProjectHistory } from '../queries/project-history';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { SystemMap } from './system-map';
export function ProjectHistory({
  projectId,
  context,
  environment,
}: {
  projectId: string;
  environment?: string | undefined;
  context: ConnectionContext;
}) {
  const read = useProjectHistory(projectId, context);
  const records = [...(read.value ?? [])].sort((a, b) =>
    (a.publishedAt ?? '').localeCompare(b.publishedAt ?? ''),
  );
  return (
    <main
      className="mx-auto flex w-full max-w-264 flex-col gap-4 p-4"
      aria-label="Project history"
    >
      <header>
        <h1 className="text-xl font-semibold">How this project is growing</h1>
        <p className="text-sm text-muted-foreground">
          Each review’s system drawing, oldest first.
        </p>
        <Link to="/" search={{}} className="text-sm text-brand">
          Back to Reviews
        </Link>
      </header>
      {read.result.waiting && <p role="status">Loading project history…</p>}
      {!read.result.waiting && records.length === 0 && (
        <p>No reviews published yet.</p>
      )}
      {records.map((record) => (
        <article
          className="flex min-w-0 flex-col gap-2 rounded-lg border p-3"
          key={record.reviewId}
        >
          <Link
            to="/reviews/$reviewId"
            params={{ reviewId: record.reviewId }}
            search={{
              environment,
              decision: undefined,
            }}
            className="text-sm font-medium text-brand wrap-anywhere"
          >
            {record.title ?? record.branch}
          </Link>
          <p className="text-xs text-muted-foreground">
            {record.publishedAt
              ? new Date(record.publishedAt).toLocaleString()
              : 'Publication date unavailable'}{' '}
            · Revision {record.latestRevision}
          </p>
          {record.diagram ? (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                {record.diagram.after.boxes
                  .filter((owner) => owner.change)
                  .map((owner) => (
                    <span key={owner.label} className="wrap-anywhere">
                      {
                        {
                          new: 'Added',
                          removed: 'Removed',
                          changed: 'Changed',
                        }[owner.change ?? 'changed']
                      }{' '}
                      · {owner.label}
                    </span>
                  ))}
              </div>
              {(record.guards ?? []).length > 0 && (
                <p className="text-xs wrap-anywhere">
                  Guards added: {(record.guards ?? []).join(', ')}
                </p>
              )}
              <SystemMap diagram={record.diagram.after} onLayer={() => {}} />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              No diagram was published for this review.
            </p>
          )}
        </article>
      ))}
    </main>
  );
}
