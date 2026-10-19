import type { ReactNode } from 'react';
import {
  verdictSections,
  type ReviewRevision,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { ProofList } from './proof-list';

export function ReviewVerdict({
  revision,
  scope,
  context,
  onStart,
}: {
  revision: ReviewRevision;
  scope: ReviewScope;
  context: ConnectionContext;
  onStart: (layerId: string) => void;
}) {
  const sections = verdictSections(revision);
  return (
    <section
      aria-label="Verdict"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6"
    >
      <VerdictSection title="Asked">
        <p className="text-sm whitespace-pre-wrap">{sections.asked.text}</p>
        <ul className="flex flex-wrap gap-3">
          {sections.asked.links.map((link) => (
            <li key={link.url}>
              <a
                className="text-sm break-all underline underline-offset-2"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.title}
              </a>
            </li>
          ))}
        </ul>
      </VerdictSection>
      <div
        className={cn(
          'rounded-xl border p-4',
          sections.recommendation.value === 'hold'
            ? 'border-graph-4/60 bg-graph-4/5'
            : 'border-graph-2/50 bg-graph-2/5',
        )}
      >
        <h2 className="mb-2 text-lg font-semibold">
          <Badge variant="outline" className="mr-2">
            Recommendation
          </Badge>
          {sections.recommendation.label}
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {sections.recommendation.reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      </div>
      <VerdictSection title={`Proven at ${sections.proven.shortHead}`}>
        <ProofList
          scope={scope}
          context={context}
          proof={{
            checks: sections.proven.checks,
            assets: sections.proven.assets,
            current: true,
          }}
          layers={revision.content.layers}
        />
        {sections.proven.checks.length + sections.proven.assets.length ===
          0 && (
          <p className="text-sm text-muted-foreground">No proof attached.</p>
        )}
      </VerdictSection>
      <VerdictSection title="Not proven">
        {sections.notProven.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing listed.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {sections.notProven.map((item, index) => (
              <li key={index}>
                <strong>{item.what}</strong>
                <span className="text-muted-foreground"> · {item.why}</span>
              </li>
            ))}
          </ul>
        )}
      </VerdictSection>
      {(sections.removed.fileCount > 0 ||
        sections.removed.groups.length > 0) && (
        <section
          aria-label="Removed"
          className="rounded-xl border-2 border-destructive bg-destructive/5 p-4"
        >
          <h2 className="mb-3 text-sm font-semibold text-destructive">
            Removed · {sections.removed.fileCount}{' '}
            {sections.removed.fileCount === 1 ? 'file' : 'files'}
          </h2>
          {sections.removed.groups.map((group, index) => (
            <div key={index} className="mb-3 text-sm">
              <p className="font-semibold">{group.behavior}</p>
              <p className="text-muted-foreground">{group.why}</p>
              <RemovedPaths paths={group.paths} />
            </div>
          ))}
          {sections.removed.unexplainedPaths.length > 0 && (
            <div>
              <p className="font-semibold text-destructive">
                No removal explanation supplied
              </p>
              <RemovedPaths paths={sections.removed.unexplainedPaths} />
            </div>
          )}
        </section>
      )}
      {sections.startHere && (
        <Button
          className="h-auto max-w-full min-w-0 self-start text-left whitespace-normal"
          onClick={() =>
            sections.startHere && onStart(sections.startHere.layerId)
          }
        >
          <span className="min-w-0 wrap-anywhere">
            Start here · {sections.startHere.title} →
          </span>
        </Button>
      )}
    </section>
  );
}
function RemovedPaths({ paths }: { paths: readonly string[] }) {
  return (
    <ul className="mt-2 space-y-1 font-mono text-xs break-all">
      {paths.map((path) => (
        <li key={path}>− {path}</li>
      ))}
    </ul>
  );
}
function VerdictSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
