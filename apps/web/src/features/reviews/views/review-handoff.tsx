import { ExternalLinkIcon } from 'lucide-react';
import type { ReviewRevision } from '@porcelain/client/reviews/rules';
import { SectionHeading } from './section-heading';

export function ReviewHandoff({ revision }: { revision: ReviewRevision }) {
  const { tryIt, coverage } = revision.verdict;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {tryIt && (
        <section
          aria-label="Try it"
          className="flex min-w-0 flex-col gap-2 rounded-lg border bg-brand-soft p-3"
        >
          <SectionHeading>Try it</SectionHeading>
          <a
            href={tryIt.url}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 items-center gap-2 text-sm font-medium text-brand wrap-anywhere"
          >
            Open preview <ExternalLinkIcon className="size-3.5 shrink-0" />
          </a>
          {tryIt.accounts.length > 0 && (
            <dl className="grid min-w-0 gap-2 text-sm @xl/review:grid-cols-2">
              {tryIt.accounts.map((account, index) => (
                <div key={index} className="min-w-0 wrap-anywhere">
                  <dt className="font-medium">{account.label}</dt>
                  <dd className="text-foreground-2">{account.signIn}</dd>
                </div>
              ))}
            </dl>
          )}
          <ol className="ml-4 list-decimal space-y-1 text-sm text-foreground-2">
            {tryIt.steps.map((step, index) => (
              <li key={index} className="wrap-anywhere">
                {step}
              </li>
            ))}
          </ol>
        </section>
      )}
      {coverage && coverage.length > 0 && (
        <section
          aria-label="Asked, built, left"
          className="flex min-w-0 flex-col gap-2"
        >
          <SectionHeading>Asked, built, left</SectionHeading>
          <div className="divide-y rounded-lg border">
            {coverage.map((row, index) => (
              <dl
                key={index}
                className="grid min-w-0 gap-2 p-3 text-sm @xl/review:grid-cols-3"
              >
                <div className="min-w-0 wrap-anywhere">
                  <dt className="text-xs text-muted-foreground">Asked</dt>
                  <dd>{row.asked}</dd>
                </div>
                <div className="min-w-0 wrap-anywhere">
                  <dt className="text-xs text-muted-foreground">Built</dt>
                  <dd>{row.built}</dd>
                </div>
                <div className="min-w-0 wrap-anywhere">
                  <dt className="text-xs text-muted-foreground">Left</dt>
                  <dd>{row.left ? row.left.what : 'Complete'}</dd>
                  {row.left && (
                    <p className="mt-1 text-xs text-warn">
                      {row.left.owner.kind === 'nobody'
                        ? 'Nobody owns this yet'
                        : `${row.left.owner.kind}: ${row.left.owner.name}`}
                    </p>
                  )}
                  {row.left &&
                    row.left.owner.kind !== 'nobody' &&
                    row.left.owner.message && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-brand">
                          Draft message
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap text-foreground-2">
                          {row.left.owner.message}
                        </p>
                      </details>
                    )}
                </div>
              </dl>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
