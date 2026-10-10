import { parsePatchFiles } from '@pierre/diffs';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { FileIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useChangeLines } from '@/features/changes/index';
import { contentVersion } from '@/shared/lib/pierre';
import type { ReviewLayer, ReviewStep } from '@porcelain/client/reviews/rules';
import type { CodeEntry } from '../adapters/code-entries';
import { contextPatch, spansLabel } from '@porcelain/client/changes/rules';
import { AgentNote } from './agent-note';
import { CodeDocument } from './code-document';
import type { WalkthroughProps } from './walkthrough-props';

export function DecisionExcerpts({
  layer,
  steps,
  ...props
}: Omit<WalkthroughProps, 'review'> & {
  layer: ReviewLayer;
  steps: readonly ReviewStep[];
}) {
  if (steps.length === 0) return null;
  return (
    <section
      aria-label="Existing code it relies on"
      className="mt-3 flex flex-col border-t"
    >
      <div className="px-4 pt-5 pb-2 font-sans">
        <h3 className="text-sm font-semibold">Existing code it relies on</h3>
        <p className="text-xs text-muted-foreground">
          The decision builds on this code without changing it.
        </p>
      </div>
      {steps.map((step) => (
        <Excerpt
          key={step.id}
          {...props}
          step={step}
          number={layer.steps.indexOf(step) + 1}
          lane={layer.lanes[step.lane] ?? ''}
        />
      ))}
    </section>
  );
}

export function excerptId(step: ReviewStep) {
  return `step-excerpt-${step.id}`;
}

function Excerpt({
  step,
  number,
  lane,
  scope,
  context,
  interaction,
  onOpen,
}: Omit<WalkthroughProps, 'review'> & {
  step: ReviewStep;
  number: number;
  lane: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const committed = step.location.state === 'committed';
  const moved = step.location.state === 'changed';
  const location = moved ? step.pointer : step.location;
  const lines = useChangeLines(
    scope,
    context.connection,
    step.pointer.path,
    location.startLine,
    location.endLine,
    !moved && (!committed || expanded),
  );
  const loaded = Option.getOrUndefined(AsyncResult.value(lines));
  const note = { title: step.title, text: step.text, marker: `${number}` };
  const entries: CodeEntry[] = [];
  if (loaded && !moved) {
    const patch = contextPatch(step.pointer.path, loaded.from, loaded.lines);
    const fileDiff = parsePatchFiles(patch).flatMap((group) => group.files)[0];
    if (fileDiff)
      entries.push({
        id: `excerpt:${step.id}`,
        kind: 'diff',
        path: step.pointer.path,
        fileDiff,
        version: contentVersion(patch),
        comment: { filePath: step.pointer.path },
        agentNotes: [{ ...note, line: location.endLine, stale: false }],
      });
  }
  return (
    <article
      id={excerptId(step)}
      aria-label={`Step ${step.title}`}
      className="flex scroll-mt-2 flex-col font-sans"
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 truncate text-sm">
          {step.pointer.path}
          <span className="text-xs text-muted-foreground">
            {' '}
            · {lane} · {spansLabel([location])}
            {committed ? ' · committed' : ''}
          </span>
        </p>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onOpen({ kind: 'file', path: step.pointer.path })}
        >
          <FileIcon data-icon="inline-start" />
          Open file
        </Button>
      </div>
      {entries.length > 0 ? (
        <CodeDocument
          scope={scope}
          context={context}
          interaction={{ ...interaction, active: false }}
          entries={entries}
          disableFileHeader
          fullHeight
        />
      ) : (
        <div className="flex flex-col items-start gap-1 px-4 pt-1">
          {moved ? (
            <p role="status" className="pl-5.5 text-sm text-graph-4">
              Code changed since the review was written.
            </p>
          ) : committed && !expanded ? (
            <Button
              variant="outline"
              size="sm"
              className="ml-5.5"
              onClick={() => setExpanded(true)}
            >
              Committed · Show code
            </Button>
          ) : (
            <p role="status" className="pl-5.5 text-sm text-muted-foreground">
              {AsyncResult.isFailure(lines)
                ? 'Code could not be loaded.'
                : 'Loading code…'}
            </p>
          )}
          <AgentNote {...note} />
        </div>
      )}
    </article>
  );
}
