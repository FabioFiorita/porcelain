import { useState, type ReactNode } from 'react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon } from 'lucide-react';
import {
  attentionLabel,
  plainText,
  type ReviewCode as ReviewCodeFiles,
  type WalkthroughContent,
  type WalkthroughRun,
  type WalkthroughStop,
} from '@porcelain/client/walkthroughs/rules';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import type { ComparedBranch, DocumentProps } from '@/features/workspace/index';
import { cn } from '@/shared/lib/utils';
import { TruncatedText } from '@/shared/views/truncated-text';
import { useHotkeysEnabled } from '@/shared/hooks/use-hotkeys-enabled';
import { RichText } from './rich-text';
import { ComparisonTable, StepBlocks } from './walkthrough-blocks';
import { ReviewCode } from './walkthrough-code-document';
import { StepButton } from './step-button';
import {
  callId,
  scrollToTarget,
  stepId,
  type Jump,
} from './walkthrough-briefing';

export type Conversation = (target: {
  kind: 'call' | 'step';
  step: number;
}) => ReactNode;

const RAIL_OFFSET = 60;

function trackSteps(onStep: (step: number) => void) {
  return (list: HTMLOListElement | null) => {
    const root = list?.closest<HTMLElement>('[data-review-scroll]');
    if (!list || !root) return;
    const update = () => {
      const line = root.getBoundingClientRect().top + RAIL_OFFSET;
      const items = Array.from(list.children);
      let reached = 0;
      items.forEach((item, index) => {
        if (item.getBoundingClientRect().top <= line) reached = index + 1;
      });
      const atEnd =
        root.scrollTop > 0 &&
        root.scrollTop + root.clientHeight >= root.scrollHeight - 2;
      const last = items.at(-1);
      const lastShown =
        last !== undefined &&
        last.getBoundingClientRect().top < root.getBoundingClientRect().bottom;
      onStep(atEnd && lastShown ? items.length : reached);
    };
    update();
    root.addEventListener('scroll', update, { passive: true });
    return () => root.removeEventListener('scroll', update);
  };
}

function StepNode({
  step,
  call,
  current,
}: {
  step: number;
  call: boolean;
  current: boolean;
}) {
  return (
    <span
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full border font-mono text-2xs tabular-nums',
        call
          ? 'border-warn-border bg-warn-soft text-warn'
          : 'bg-background text-muted-foreground',
        current && 'border-foreground text-foreground',
      )}
    >
      {step}
    </span>
  );
}

function StepRail({
  stops,
  current,
  outside,
  onStep,
  onJump,
}: {
  stops: readonly WalkthroughStop[];
  current: number;
  outside: number;
  onStep: (delta: 1 | -1) => void;
  onJump: Jump;
}) {
  const shown = Math.max(current, 1);
  const stop = stops[shown - 1]!;
  return (
    <nav
      aria-label="Step navigation"
      className="sticky top-0 z-10 -mx-5 flex h-11 items-center gap-3 border-b bg-card px-5 @3xl:-mx-8 @3xl:px-8"
    >
      <p className="flex min-w-0 flex-1 items-baseline gap-2 text-ui">
        <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
          Step {shown} of {stops.length}
        </span>
        <TruncatedText
          text={plainText(stop.title)}
          className="min-w-0 flex-1 font-medium"
        />
      </p>
      <ol className="hidden items-center gap-1 @xl:flex">
        {stops.map((entry, index) => (
          <li key={index}>
            <button
              type="button"
              aria-label={`Step ${index + 1}: ${plainText(entry.title)}`}
              aria-current={current === index + 1 ? 'step' : undefined}
              onClick={() => onJump(stepId(index + 1))}
              className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
            >
              <StepNode
                step={index + 1}
                call={entry.callouts.length > 0}
                current={current === index + 1}
              />
            </button>
          </li>
        ))}
      </ol>
      {outside > 0 && (
        <button
          type="button"
          onClick={() => onJump('review-not-covered')}
          className="hidden shrink-0 text-caption text-muted-foreground hover:text-foreground @2xl:block"
        >
          {outside === 1 ? '1 file' : `${outside} files`} not in a step
        </button>
      )}
      <span className="flex shrink-0 items-center">
        <StepButton
          label="Previous step"
          icon={<ChevronUpIcon />}
          disabled={current <= 1}
          onClick={() => onStep(-1)}
        />
        <StepButton
          label="Next step"
          icon={<ChevronDownIcon />}
          disabled={current >= stops.length}
          onClick={() => onStep(1)}
        />
        <KbdGroup aria-hidden className="ml-1 hidden @2xl:inline-flex">
          <Kbd>J</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </span>
    </nav>
  );
}

function CallPanel({
  stop,
  step,
  conversation,
}: {
  stop: WalkthroughStop;
  step: number;
  conversation: Conversation | undefined;
}) {
  return stop.callouts.map(({ attention, comparison }, index) => (
    <section
      key={index}
      id={callId(step, index)}
      aria-label={attentionLabel(attention)}
      className="flex flex-col gap-2.5 rounded-md border border-warn-border bg-warn-soft/60 p-3"
    >
      <p className="text-caption font-medium text-warn">
        Your call · {attentionLabel(attention)}
      </p>
      <h3 className="text-section font-semibold text-pretty">
        <RichText text={attention.question} />
      </h3>
      <p className="text-ui text-foreground-2">
        <RichText text={attention.note} />
      </p>
      {comparison && <ComparisonTable comparison={comparison} />}
      {index === 0 && conversation?.({ kind: 'call', step })}
    </section>
  ));
}

function StepCode({
  props,
  code,
  branch,
  eager,
  step,
}: {
  props: DocumentProps;
  code: ReviewCodeFiles;
  branch: ComparedBranch | undefined;
  eager: boolean;
  step: number;
}) {
  const [open, setOpen] = useState(false);
  const files = new Set([...(branch ? code.branch : []), ...code.worktree])
    .size;
  if (files === 0) return null;
  return (
    <div className="border-t">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-9 w-full items-center gap-1.5 px-4 text-left text-caption text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <ChevronRightIcon
          aria-hidden
          className={cn('size-3.5', open && 'rotate-90')}
        />
        Full diff of this step
        <span className="tabular-nums">
          · {files === 1 ? '1 file' : `${files} files`}
        </span>
      </button>
      {open && (
        <div className="border-t">
          <ReviewCode
            document={props}
            entry={`review:step-${step}`}
            code={code}
            branch={branch}
            eager={eager}
            label={`Step ${step}`}
            bleed=""
          />
        </div>
      )}
    </div>
  );
}

function StepCard({
  stop,
  step,
  last,
  current,
  run,
  props,
  code,
  branch,
  eager,
  conversation,
}: {
  stop: WalkthroughStop;
  step: number;
  last: boolean;
  current: boolean;
  run: WalkthroughRun;
  props: DocumentProps;
  code: ReviewCodeFiles | undefined;
  branch: ComparedBranch | undefined;
  eager: boolean;
  conversation: Conversation | undefined;
}) {
  const call = stop.callouts.length > 0;
  return (
    <li
      id={stepId(step)}
      className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3"
    >
      <div aria-hidden className="flex flex-col items-center pt-3.5">
        <StepNode step={step} call={call} current={current} />
        {!last && <span className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <article
        aria-labelledby={`${stepId(step)}-title`}
        className={cn(
          'mb-5 flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card',
          call && 'border-warn-border',
        )}
      >
        <div className="flex flex-col gap-3 p-4">
          <header className="flex flex-col gap-1">
            <h2
              id={`${stepId(step)}-title`}
              className="text-section font-semibold text-pretty"
            >
              <span className="sr-only">Step {step}: </span>
              <RichText text={stop.title} />
            </h2>
            <p className="text-prose text-foreground-2">
              <RichText text={stop.explanation} />
            </p>
          </header>
          <CallPanel stop={stop} step={step} conversation={conversation} />
          <StepBlocks
            blocks={stop.blocks}
            step={step}
            run={run}
            document={props}
          />
        </div>
        {code && (
          <StepCode
            props={props}
            code={code}
            branch={branch}
            eager={eager}
            step={step}
          />
        )}
        {conversation && (
          <div className="border-t px-4 py-3">
            {conversation({ kind: 'step', step })}
          </div>
        )}
      </article>
    </li>
  );
}

function StepKeys({ onStep }: { onStep: (delta: 1 | -1) => void }) {
  useHotkey('J', () => onStep(1), { ignoreInputs: true });
  useHotkey('K', () => onStep(-1), { ignoreInputs: true });
  return null;
}

export function WalkthroughSteps({
  content,
  run,
  props,
  code,
  branch,
  eager,
  outside,
  conversation,
  onJump,
}: {
  content: WalkthroughContent;
  run: WalkthroughRun;
  props: DocumentProps;
  code: readonly ReviewCodeFiles[];
  branch: ComparedBranch | undefined;
  eager: readonly boolean[];
  outside: number;
  conversation: Conversation | undefined;
  onJump: Jump;
}) {
  const [current, setCurrent] = useState(0);
  const total = content.stops.length;
  const step = (delta: 1 | -1, behavior: ScrollBehavior = 'smooth') => {
    const next = Math.min(Math.max(current + delta, 1), total);
    scrollToTarget(stepId(next), behavior);
  };
  const hotkeys =
    useHotkeysEnabled() &&
    props.interaction.active &&
    props.interaction.hidden !== true;
  if (total === 0) return null;
  return (
    <section
      aria-label="Steps"
      aria-keyshortcuts="J K"
      className="flex flex-col"
    >
      {hotkeys && <StepKeys onStep={(delta) => step(delta, 'auto')} />}
      <StepRail
        stops={content.stops}
        current={current}
        outside={outside}
        onStep={step}
        onJump={onJump}
      />
      <ol ref={trackSteps(setCurrent)} className="flex flex-col pt-5">
        {content.stops.map((stop, index) => (
          <StepCard
            key={index}
            stop={stop}
            step={index + 1}
            last={index === total - 1}
            current={current === index + 1}
            run={run}
            props={props}
            code={code[index]}
            branch={branch}
            eager={eager[index] ?? true}
            conversation={conversation}
          />
        ))}
      </ol>
    </section>
  );
}
