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
import { contextPatch, spansLabel } from '../rules/patch-focus';
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
      className="mx-auto flex max-w-4xl flex-col gap-3 px-5 pt-6"
    >
      <h3 className="text-sm font-semibold">Existing code it relies on</h3>
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
      });
  }
  return (
    <article
      aria-label={`Step ${step.title}`}
      className="flex flex-col gap-2 rounded-xl border bg-background p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-2xs font-semibold text-muted-foreground tabular-nums">
          {number}
        </span>
        <h4 className="min-w-0 flex-1 text-sm font-medium">{step.title}</h4>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onOpen({ kind: 'file', path: step.pointer.path })}
        >
          <FileIcon data-icon="inline-start" />
          Open file
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {lane} · {step.kind === 'context' ? 'Existing code' : 'Committed code'}{' '}
        · {step.pointer.path} · {spansLabel([location])}
      </p>
      {moved ? (
        <p role="status" className="text-sm text-graph-4">
          Code changed since the review was written.
        </p>
      ) : committed && !expanded ? (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setExpanded(true)}
        >
          Committed · Show code
        </Button>
      ) : entries.length > 0 ? (
        <div className="flex min-w-0 flex-col">
          <CodeDocument
            scope={scope}
            context={context}
            interaction={{ ...interaction, active: false }}
            entries={entries}
            collapsible
            fullHeight
          />
        </div>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          {AsyncResult.isFailure(lines)
            ? 'Code could not be loaded.'
            : 'Loading code…'}
        </p>
      )}
      <AgentNote text={step.text} marker={`${number}`} />
    </article>
  );
}
