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
import type { ComparedBranch, DocumentProps } from '@/features/workspace/index';
import { cn } from '@/shared/lib/utils';
import { TruncatedText } from '@/shared/views/truncated-text';
import { useHotkeysEnabled } from '@/shared/hooks/use-hotkeys-enabled';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { RichText } from './rich-text';
import { ComparisonTable, StepBlocks } from './walkthrough-blocks';
import { ReviewCode } from './walkthrough-code-document';
import { StepButton } from './step-button';
import type { WalkthroughPull } from '../queries/pull';
import {
  callId,
  scrollToTarget,
  stepId,
  type Jump,
} from './walkthrough-briefing';

export type Conversation = (target: { step: number }) => ReactNode;

export type Decision = (target: {
  step: number;
  index: number;
  comparison: WalkthroughStop['callouts'][number]['comparison'];
}) => ReactNode;

const RAIL_OFFSET = 60;

function trackSteps(onStep: (step: number, titled: boolean) => void) {
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
      const step = atEnd && lastShown ? items.length : reached;
      const heading = items[step - 1]?.querySelector('h2');
      const rail = list.previousElementSibling?.getBoundingClientRect().bottom;
      onStep(
        step,
        heading !== undefined &&
          heading !== null &&
          rail !== undefined &&
          heading.getBoundingClientRect().bottom <= rail,
      );
    };
    update();
    root.addEventListener('scroll', update, { passive: true });
    return () => root.removeEventListener('scroll', update);
  };
}

function StepRail({
  stops,
  current,
  titled,
  outside,
  onStep,
  onJump,
}: {
  stops: readonly WalkthroughStop[];
  current: number;
  titled: boolean;
  outside: number;
  onStep: (delta: 1 | -1) => void;
  onJump: Jump;
}) {
  const shown = Math.max(current, 1);
  const stop = stops[shown - 1]!;
  return (
    <nav
      aria-label="Step navigation"
      className="sticky top-0 z-10 -mx-5 bg-card px-5 @3xl:-mx-8 @3xl:px-8"
    >
      <div className="flex h-11 items-center gap-3 border-b">
        <p className="flex min-w-0 flex-1 items-baseline gap-2 text-ui">
          <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
            {current === 0
              ? `${stops.length} ${stops.length === 1 ? 'step' : 'steps'}`
              : `Step ${shown} of ${stops.length}`}
          </span>
          {titled && current > 0 && (
            <TruncatedText
              text={plainText(stop.title)}
              className="min-w-0 flex-1 font-medium"
            />
          )}
        </p>
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
            shortcut="K"
            icon={<ChevronUpIcon />}
            disabled={current <= 1}
            onClick={() => onStep(-1)}
          />
          <StepButton
            label="Next step"
            shortcut="J"
            icon={<ChevronDownIcon />}
            disabled={current >= stops.length}
            onClick={() => onStep(1)}
          />
        </span>
      </div>
    </nav>
  );
}

function CallPanel({
  stop,
  step,
  decision,
}: {
  stop: WalkthroughStop;
  step: number;
  decision: Decision | undefined;
}) {
  return stop.callouts.map(({ attention, comparison }, index) => (
    <section
      key={index}
      id={callId(step, index)}
      aria-label={`Your call: ${attentionLabel(attention)}`}
      className="flex flex-col gap-2 border-l-2 border-warn pl-4"
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
      {decision?.({ step, index, comparison })}
    </section>
  ));
}

function FullDiff({
  props,
  code,
  branch,
  eager,
  step,
  open,
  onOpen,
}: {
  props: DocumentProps;
  code: ReviewCodeFiles;
  branch: ComparedBranch | undefined;
  eager: boolean;
  step: number;
  open: boolean;
  onOpen: (open: boolean) => void;
}) {
  const files = new Set([...(branch ? code.branch : []), ...code.worktree])
    .size;
  if (files === 0) return null;
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpen(!open)}
        className="-mx-2 flex h-8 items-center gap-1.5 self-start rounded-md px-2 text-left text-caption text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
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
        <ReviewCode
          document={props}
          entry={`review:step-${step}`}
          code={code}
          branch={branch}
          eager={eager}
          label={`Step ${step}`}
          bleed=""
        />
      )}
    </div>
  );
}

function StepCard({
  stop,
  step,
  run,
  props,
  code,
  branch,
  eager,
  conversation,
  decision,
  pull,
}: {
  pull: WalkthroughPull;
  stop: WalkthroughStop;
  step: number;
  run: WalkthroughRun;
  props: DocumentProps;
  code: ReviewCodeFiles | undefined;
  branch: ComparedBranch | undefined;
  eager: boolean;
  conversation: Conversation | undefined;
  decision: Decision | undefined;
}) {
  const [diffOpen, setDiffOpen] = useState(false);
  return (
    <li id={stepId(step)} className="border-t py-6 first:border-t-0 first:pt-5">
      <article
        aria-labelledby={`${stepId(step)}-title`}
        className="flex min-w-0 flex-col gap-4"
      >
        <header className="flex flex-col gap-1">
          <h2
            id={`${stepId(step)}-title`}
            className="flex gap-2.5 text-section font-semibold text-pretty"
          >
            <span className="shrink-0 font-normal text-muted-foreground tabular-nums">
              <span className="sr-only">Step </span>
              {step}
              <span className="sr-only">: </span>
            </span>
            <span className="min-w-0">
              <RichText text={stop.title} />
            </span>
          </h2>
          <p className="text-prose text-foreground-2">
            <RichText text={stop.explanation} />
          </p>
        </header>
        <CallPanel stop={stop} step={step} decision={decision} />
        <StepBlocks
          blocks={stop.blocks}
          step={step}
          title={plainText(stop.title)}
          run={run}
          document={props}
          pull={pull}
          linesInFullDiff={diffOpen}
        />
        {code && (
          <FullDiff
            props={props}
            code={code}
            branch={branch}
            eager={eager}
            step={step}
            open={diffOpen}
            onOpen={setDiffOpen}
          />
        )}
        {conversation?.({ step })}
      </article>
    </li>
  );
}

function StepKeys({
  onStep,
  onComment,
}: {
  onStep: (delta: 1 | -1) => void;
  onComment: () => void;
}) {
  useHotkey('J', () => onStep(1), { ignoreInputs: true });
  useHotkey('K', () => onStep(-1), { ignoreInputs: true });
  useHotkey(SHORTCUTS.comment, onComment, {
    ignoreInputs: true,
    preventDefault: true,
  });
  return null;
}

function focusStepComposer(step: number) {
  const box = document
    .getElementById(stepId(step))
    ?.querySelector<HTMLTextAreaElement>('textarea');
  box?.scrollIntoView({ block: 'center' });
  box?.focus();
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
  decision,
  pull,
  onJump,
}: {
  pull: WalkthroughPull;
  content: WalkthroughContent;
  run: WalkthroughRun;
  props: DocumentProps;
  code: readonly ReviewCodeFiles[];
  branch: ComparedBranch | undefined;
  eager: readonly boolean[];
  outside: number;
  conversation: Conversation | undefined;
  decision?: Decision | undefined;
  onJump: Jump;
}) {
  const [{ current, titled }, setPosition] = useState({
    current: 0,
    titled: false,
  });
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
      aria-keyshortcuts="J K C"
      className="flex flex-col"
    >
      {hotkeys && (
        <StepKeys
          onStep={(delta) => step(delta, 'auto')}
          onComment={() => focusStepComposer(Math.max(current, 1))}
        />
      )}
      <StepRail
        stops={content.stops}
        current={current}
        titled={titled}
        outside={outside}
        onStep={step}
        onJump={onJump}
      />
      <ol
        ref={trackSteps((next, nextTitled) =>
          setPosition((position) =>
            position.current === next && position.titled === nextTitled
              ? position
              : { current: next, titled: nextTitled },
          ),
        )}
        className="flex flex-col"
      >
        {content.stops.map((stop, index) => (
          <StepCard
            key={index}
            stop={stop}
            step={index + 1}
            run={run}
            props={props}
            code={code[index]}
            branch={branch}
            eager={eager[index] ?? true}
            conversation={conversation}
            decision={decision}
            pull={pull}
          />
        ))}
      </ol>
    </section>
  );
}
