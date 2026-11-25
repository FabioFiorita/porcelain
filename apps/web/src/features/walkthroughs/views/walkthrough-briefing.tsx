import type { ReactNode } from 'react';
import { CheckIcon, ImagesIcon } from 'lucide-react';
import {
  attentionLabel,
  callDecisionProgress,
  walkthroughCalls,
  walkthroughEvidenceNotice,
  type WalkthroughContent,
  type WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import { recordedChecks } from '@porcelain/client/projects/rules';
import { CheckResultIcon } from '@/features/workspace/index';
import { RichText } from './rich-text';
import { checksTone } from './walkthrough-blocks';
import {
  useConversations,
  type ConversationScope,
} from '../queries/conversations';
import type { WalkthroughPull } from '../queries/pull';

type Decided = {
  readonly step: number;
  readonly call: number;
  readonly option?: string | undefined;
};

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

function BriefingRow({
  label,
  detail,
  children,
}: {
  label: string;
  detail?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-x-4 gap-y-1 border-t py-2.5 first:border-t-0 @xl:grid-cols-[7rem_minmax(0,1fr)]">
      <dt className="flex flex-col pt-1 text-caption text-muted-foreground">
        {label}
        {detail && <span className="tabular-nums">{detail}</span>}
      </dt>
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
  decisions,
  onJump,
}: {
  content: WalkthroughContent;
  decisions: readonly Decided[] | undefined;
  onJump: Jump;
}) {
  const calls = walkthroughCalls(content);
  if (calls.length === 0)
    return (
      <p className="py-1 text-ui text-muted-foreground">
        Nothing needs your decision.
      </p>
    );
  return calls.map(({ attention, step, callIndex }) => {
    const decided = decisions?.find(
      (entry) => entry.step === step && entry.call === callIndex,
    );
    return (
      <Line
        key={`${step}:${callIndex}`}
        target={`Step ${step}`}
        onClick={() => onJump(callId(step, callIndex))}
      >
        {decided ? (
          <CheckIcon
            aria-label="Decided"
            className="size-3.5 shrink-0 self-center text-add-fg"
          />
        ) : (
          <span className="shrink-0 text-caption text-warn">
            {attentionLabel(attention)}
          </span>
        )}
        <span className="min-w-0 font-medium text-pretty">
          <RichText text={attention.question} />
          {decided?.option && (
            <span className="font-normal text-muted-foreground">
              {' '}
              · {decided.option}
            </span>
          )}
        </span>
      </Line>
    );
  });
}

function CheckLink({
  name,
  label,
  pull,
}: {
  name: string;
  label: string;
  pull: WalkthroughPull;
}) {
  if (!pull) return <span>{name}</span>;
  return (
    <button
      type="button"
      title={`${label} · open on #${pull.number}`}
      onClick={() => pull.openCheck(name)}
      className="rounded-sm underline decoration-border underline-offset-2 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      {name}
    </button>
  );
}

function Verified({
  run,
  content,
  pull,
  onJump,
}: {
  run: WalkthroughRun;
  content: WalkthroughContent;
  pull: WalkthroughPull;
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
        const moved =
          pull?.detail && pull.detail.headSha !== block.checks.headOid
            ? pull.detail.headSha.slice(0, 7)
            : undefined;
        return (
          <div
            key={`checks:${step}`}
            className="flex min-h-7 items-baseline gap-2 py-1 text-ui"
          >
            <span className="self-center">
              <CheckResultIcon tone={checksTone(block.checks)} />
            </span>
            <span className="min-w-0 flex-1 text-pretty">
              {recorded.label}
              <span className="text-muted-foreground">: </span>
              {recorded.results.map((result, index) => (
                <span key={`${result.name}:${index}`}>
                  <CheckLink
                    name={result.name}
                    label={result.label}
                    pull={pull}
                  />
                  {index < recorded.results.length - 1 && (
                    <span className="text-muted-foreground">, </span>
                  )}
                </span>
              ))}
              {recorded.more && (
                <span className="text-muted-foreground"> and more</span>
              )}
              {moved && pull && (
                <span className="text-warn">
                  {' '}
                  · #{pull.number} is now at{' '}
                  <span className="font-mono text-caption">{moved}</span>
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => onJump(stepId(step))}
              className="shrink-0 rounded-sm text-caption text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              Step {step}
            </button>
          </div>
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

function BriefingRows({
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
  owner,
  pull,
  onJump,
  notSaid,
  comments,
}: {
  run: WalkthroughRun;
  content: WalkthroughContent;
  owner: ConversationScope;
  pull: WalkthroughPull;
  onJump: Jump;
  notSaid?: ReactNode;
  comments?: ReactNode;
}) {
  const { view } = useConversations(owner);
  const progress = callDecisionProgress(content, view?.decisions);
  return (
    <BriefingRows label="Before you merge">
      <BriefingRow
        label={progress.total === 1 ? 'Your call' : 'Your calls'}
        detail={
          progress.total === 0
            ? undefined
            : `${progress.decided} of ${progress.total} decided`
        }
      >
        <Calls content={content} decisions={view?.decisions} onJump={onJump} />
      </BriefingRow>
      <BriefingRow label="Verified">
        <Verified run={run} content={content} pull={pull} onJump={onJump} />
      </BriefingRow>
      {notSaid && <BriefingRow label="Not verified">{notSaid}</BriefingRow>}
      {comments && <BriefingRow label="Comments">{comments}</BriefingRow>}
    </BriefingRows>
  );
}
