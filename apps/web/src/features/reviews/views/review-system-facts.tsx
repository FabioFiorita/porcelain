import type { ReviewRevision } from '@porcelain/client/reviews/rules';
import { Badge } from '@/components/ui/badge';
import { TruncatedText } from '@/shared/views/truncated-text';

const labels = { new: 'New', changed: 'Changed', removed: 'Removed' } as const;

export function ReviewSystemFacts({ revision }: { revision: ReviewRevision }) {
  const system = revision.content.system;
  if (!system) return null;
  return (
    <div className="mt-3 flex min-w-0 flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        File changes from Git, grouped by folder. Import relationships are not
        computed yet.
      </p>
      <div className="grid min-w-0 gap-2 @2xl/review:grid-cols-2">
        {system.owners.map((owner) => (
          <details
            key={owner.path}
            className="min-w-0 rounded-lg border px-3 py-2"
          >
            <summary className="cursor-pointer text-ui font-medium wrap-anywhere">
              {owner.path}{' '}
              <span className="text-xs text-muted-foreground">
                · {owner.files.length} files
              </span>
            </summary>
            <ul className="mt-2 flex min-w-0 flex-col gap-1.5">
              {owner.files.map((file) => (
                <li key={file.path} className="flex min-w-0 items-center gap-2">
                  <Badge variant="outline">{labels[file.change]}</Badge>
                  <TruncatedText className="min-w-0 text-xs" text={file.path} />
                </li>
              ))}
            </ul>
            {owner.annotations.map((box) => (
              <p
                key={box.id}
                className="mt-2 text-xs text-muted-foreground wrap-anywhere"
              >
                Agent note: {box.label}
                {box.detail ? ` · ${box.detail}` : ''}
              </p>
            ))}
          </details>
        ))}
      </div>
      {system.guards.length > 0 && (
        <section
          aria-label="Guard files changed"
          className="rounded-lg border p-3"
        >
          <h3 className="text-ui font-medium">Guard files changed</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Lint and architecture files touched by this change; the checks above
            show what ran.
          </p>
          <ul className="mt-2 flex min-w-0 flex-col gap-1">
            {system.guards.map((path) => (
              <li key={path} className="text-xs wrap-anywhere">
                {path} ·{' '}
                {
                  system.owners
                    .flatMap((owner) => owner.files)
                    .find((file) => file.path === path)?.change
                }
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
