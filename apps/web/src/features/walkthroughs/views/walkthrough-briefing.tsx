import type { ReactNode } from 'react';
import { ImagesIcon } from 'lucide-react';
import {
  attentionLabel,
  walkthroughCalls,
  walkthroughEvidenceNotice,
  type WalkthroughContent,
  type WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import { recordedChecks } from '@porcelain/client/projects/rules';
import { CheckResultIcon } from '@/features/workspace/index';
import { RichText } from './rich-text';
import { checksTone } from './walkthrough-blocks';

export type Jump = (id: string) => void;

const STEP_RAIL_HEIGHT = 52;

export function scrollToTarget(
  id: string,
  behavior: ScrollBehavior = 'smooth',
) {
  const target = document.getElementById(id);
  const root = target?.closest<HTMLElement>('[data-review-scroll]');
  if (!target || !root) return;
  const offset = id.startsWith('walkthrough-') ? STEP_RAIL_HEIGHT : 16;
  root.scrollTo({
    top:
      root.scrollTop +
      target.getBoundingClientRect().top -
      root.getBoundingClientRect().top -
      offset,
    behavior,
  });
}

export const stepId = (step: number) => `walkthrough-step-${step}`;
export const callId = (step: number, index: number) =>
  `walkthrough-call-${step}-${index}`;

function stepsLabel(steps: readonly number[]) {
  const unique = [...new Set(steps)];
  return unique.length === 1
    ? `Step ${unique[0]}`
    : `Steps ${unique.join(', ')}`;
}

export function BriefingRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-x-4 gap-y-1 border-t py-2.5 first:border-t-0 @xl:grid-cols-[7rem_minmax(0,1fr)]">
      <dt className="pt-1 text-caption text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-col">{children}</dd>
    </div>
  );
}

function Line({
  onClick,
  target,
  children,
}: {
  onClick: () => void;
  target: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-mx-2 flex min-h-7 items-baseline gap-2 rounded-md px-2 py-1 text-left text-ui hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        {children}
      </span>
      <span className="shrink-0 text-caption text-muted-foreground">
        {target}
      </span>
    </button>
  );
}

function Calls({
  content,
  onJump,
}: {
  content: WalkthroughContent;
  onJump: Jump;
}) {
  const calls = walkthroughCalls(content);
  if (calls.length === 0)
    return (
      <p className="py-1 text-ui text-muted-foreground">
        Nothing needs your decision.
      </p>
    );
  return calls.map(({ attention, step, callIndex }) => (
    <Line
      key={`${step}:${callIndex}`}
      target={`Step ${step}`}
      onClick={() => onJump(callId(step, callIndex))}
    >
      <span className="shrink-0 text-caption text-warn">
        {attentionLabel(attention)}
      </span>
      <span className="min-w-0 font-medium text-pretty">
        <RichText text={attention.question} />
      </span>
    </Line>
  ));
}

function Verified({
  run,
  content,
  onJump,
}: {
  run: WalkthroughRun;
  content: WalkthroughContent;
  onJump: Jump;
}) {
  const checks = content.stops.flatMap((stop, index) =>
    stop.blocks.flatMap((block) =>
      block.kind === 'checks' ? [{ block, step: index + 1 }] : [],
    ),
  );
  const pairs = content.stops.flatMap((stop, index) =>
    stop.blocks.flatMap((block) =>
      block.kind === 'images' ? [index + 1] : [],
    ),
  );
  const notice = walkthroughEvidenceNotice(run);
  return (
    <>
      {checks.map(({ block, step }) => {
        const recorded = recordedChecks(block.checks);
        const count = recorded.results.length;
        return (
          <Line
            key={`checks:${step}`}
            target={`Step ${step}`}
            onClick={() => onJump(stepId(step))}
          >
            <span className="self-center">
              <CheckResultIcon tone={checksTone(block.checks)} />
            </span>
            <span className="min-w-0">
              {recorded.label}
              <span className="text-muted-foreground">
                {' · '}
                {count === 1 ? '1 check' : `${count} checks`}
                {recorded.more && ' and more on the pull request'}
              </span>
            </span>
          </Line>
        );
      })}
      {pairs.length > 0 && (
        <Line
          target={stepsLabel(pairs)}
          onClick={() => onJump(stepId(pairs[0]!))}
        >
          <ImagesIcon
            aria-hidden
            className="size-3.5 shrink-0 self-center text-muted-foreground"
          />
          <span className="min-w-0">
            {pairs.length === 1
              ? 'Before and after screenshots'
              : `${pairs.length} before and after pairs`}
          </span>
        </Line>
      )}
      {notice && <p className="py-1 text-ui text-muted-foreground">{notice}</p>}
      {!notice && checks.length === 0 && pairs.length === 0 && (
        <p className="py-1 text-ui text-muted-foreground">
          No checks or screenshots were captured for{' '}
          <span className="font-mono">{run.headOid.slice(0, 7)}</span>.
        </p>
      )}
    </>
  );
}

function callsLabel(calls: number) {
  if (calls === 1) return 'Your call';
  return calls === 0 ? 'Your calls' : `Your calls · ${calls}`;
}

export function BriefingRows({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <dl
      aria-label={label}
      className="flex flex-col rounded-lg border px-4 py-1"
    >
      {children}
    </dl>
  );
}

export function Briefing({
  run,
  content,
  onJump,
}: {
  run: WalkthroughRun;
  content: WalkthroughContent;
  onJump: Jump;
}) {
  const calls = walkthroughCalls(content).length;
  return (
    <BriefingRows label="Before you merge">
      <BriefingRow label={callsLabel(calls)}>
        <Calls content={content} onJump={onJump} />
      </BriefingRow>
      <BriefingRow label="Verified">
        <Verified run={run} content={content} onJump={onJump} />
      </BriefingRow>
    </BriefingRows>
  );
}
