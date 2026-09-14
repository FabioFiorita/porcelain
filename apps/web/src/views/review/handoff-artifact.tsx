import { formatDistanceToNowStrict } from 'date-fns';
import {
  ChevronRightIcon,
  FileTextIcon,
  NewspaperIcon,
  SparklesIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DocumentRef } from '../../domain/documents';
import type { Layers, ReviewScope } from '../../domain/review';
import { useArtifactContents, useArtifacts } from '../../query/review';
import { MarkdownView } from './markdown-view';

/** Names reserved for the short handoff summary and the optional report. */
export const HANDOFF_ARTIFACT_NAMES = {
  html: 'handoff.html',
  markdown: 'handoff.md',
} as const;

type Layer = Layers['layers'][number];
type OpenDocument = (ref: DocumentRef) => void;

/**
 * The agent-authored part of the handoff. The markdown is kept in its own
 * artifact, so this presentation never invents or persists a second schema.
 */
export function HandoffSummary({
  scope,
  layers,
  onOpen,
}: {
  scope: ReviewScope;
  layers: readonly Layer[];
  onOpen: OpenDocument;
}) {
  const artifacts = useArtifacts(scope);
  const summary = artifacts.find(
    (artifact) => artifact.name === HANDOFF_ARTIFACT_NAMES.markdown,
  );
  const report = artifacts.find(
    (artifact) => artifact.name === HANDOFF_ARTIFACT_NAMES.html,
  );
  const others = artifacts.filter(
    (artifact) => artifact !== summary && artifact !== report,
  );
  const [content] = useArtifactContents(
    scope,
    summary == null ? [] : [summary.id],
  );

  if (
    summary == null &&
    report == null &&
    others.length === 0 &&
    layers.length === 0
  )
    return null;

  const created = (summary ?? report ?? others[0])?.createdAt;
  return (
    <section className="mx-4 mt-3 overflow-hidden rounded-xl border bg-card">
      <header className="flex min-h-10 items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
        <SparklesIcon className="size-3.5 text-muted-foreground" />
        <span className="text-[12.5px] font-medium">From the agent</span>
        {created != null && (
          <time
            dateTime={created}
            className="text-[11px] text-muted-foreground"
          >
            {formatDistanceToNowStrict(new Date(created), { addSuffix: true })}
          </time>
        )}
        <div className="ml-auto flex items-center gap-1">
          {others.map((artifact) => (
            <Button
              key={artifact.id}
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 max-w-44 px-2 text-xs"
              title={artifact.name}
              onClick={() =>
                onOpen({ kind: 'artifact', artifactId: artifact.id })
              }
            >
              <FileTextIcon data-icon="inline-start" />
              <span className="truncate">{artifact.name}</span>
            </Button>
          ))}
          {report != null && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() =>
                onOpen({ kind: 'artifact', artifactId: report.id })
              }
            >
              <NewspaperIcon data-icon="inline-start" />
              Open report
            </Button>
          )}
        </div>
      </header>

      {content != null ? (
        <MarkdownView
          text={content.content}
          className="max-w-[78ch] px-4 py-1 text-[13px]"
        />
      ) : (
        report != null && (
          <p className="px-4 py-3 text-[12.5px] text-muted-foreground">
            The agent left a report but no summary.
          </p>
        )
      )}

      {layers.length > 0 && (
        <div className="border-t px-2 py-2">
          <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">
            Read in this order
          </p>
          {layers.map((layer, index) => (
            <LayerLink
              key={layer.id}
              layer={layer}
              index={index}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LayerLink({
  layer,
  index,
  onOpen,
}: {
  layer: Layer;
  index: number;
  onOpen: OpenDocument;
}) {
  return (
    <button
      type="button"
      className="group flex w-full min-w-0 items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent"
      onClick={() => onOpen({ kind: 'layer', layerId: layer.id })}
    >
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-muted text-[10.5px] text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[12.5px] font-medium">
          <span className="truncate">{layer.title}</span>
          <span className="shrink-0 text-[11px] font-normal text-muted-foreground">
            {layer.files.length} {layer.files.length === 1 ? 'file' : 'files'}
          </span>
        </span>
        {layer.summary != null && (
          <MarkdownView
            text={layer.summary}
            className="max-w-[78ch] text-[12px] text-muted-foreground [&_p]:my-0.5"
          />
        )}
      </span>
      <ChevronRightIcon className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
