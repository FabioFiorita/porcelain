import type { ReactNode } from 'react';
import { CheckIcon } from 'lucide-react';
import {
  attentionLabel,
  callDecisionProgress,
  walkthroughCalls,
  walkthroughEvidenceNotice,
  walkthroughScope,
  type WalkthroughContent,
  type WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import {
  capturedCheckNames,
  capturedCheckRest,
  movedPullHead,
  recordedChecks,
  walkthroughCheckRows,
  type currentWalkthroughChecks,
} from '@porcelain/client/projects/rules';
import { CheckResultIcon } from '@/features/workspace/index';
import { cn } from '@/shared/lib/utils';
import { RichText } from './rich-text';
import { ShortOid } from './short-oid';
import { checksTone } from './walkthrough-blocks';
import { EvidenceThumbnails } from './walkthrough-evidence';
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
  centered = false,
  children,
}: {
  onClick: () => void;
  target: string;
  centered?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        '-mx-2 flex min-h-7 gap-2 rounded-md px-2 py-1 text-left text-ui hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
        centered ? 'items-center' : 'items-baseline',
      )}
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
  return calls.map(({ attention, stop, step, callIndex }) => {
    const decided = decisions?.find(
      (entry) => entry.step === step && entry.call === callIndex,
    );
    return (
      <Line
        key={`${step}:${callIndex}`}
        target={`Step ${step}`}
        onClick={() => onJump(callId(step, callIndex))}
      >
        <span className="flex min-w-0 flex-col gap-0.5 @md:flex-row @md:items-baseline @md:gap-2">
          <span
            className={cn(
              'flex shrink-0 items-baseline gap-1 text-caption @md:w-28',
              decided ? 'text-muted-foreground' : 'text-warn',
            )}
          >
            {decided && (
              <CheckIcon
                aria-label="Decided"
                className="size-3 shrink-0 self-center text-add-fg"
              />
            )}
            {attentionLabel(attention)}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium text-pretty">
              <RichText text={attention.question} />
              {decided?.option && (
                <span className="font-normal text-muted-foreground">
                  {' '}
                  · {decided.option}
                </span>
              )}
            </span>
            <span className="text-pretty text-foreground-2">
              <RichText text={stop.explanation} />
            </span>
          </span>
        </span>
      </Line>
    );
  });
}

function CheckLink({ name, pull }: { name: string; pull: WalkthroughPull }) {
  if (!pull) return <span>{name}</span>;
  return (
    <button
      type="button"
      title={`Open on #${pull.number}`}
      onClick={() => pull.openCheck(name)}
      className="rounded-sm underline decoration-border underline-offset-2 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      {name}
    </button>
  );
}

function CheckNames({
  names,
  pull,
}: {
  names: readonly string[];
  pull: WalkthroughPull;
}) {
  return names.map((name, index) => (
    <span key={`${name}:${index}`}>
      <span className="whitespace-nowrap">
        <CheckLink name={name} pull={pull} />
        {index < names.length - 1 && (
          <span className="text-muted-foreground">,</span>
        )}
      </span>
      {index < names.length - 1 && ' '}
    </span>
  ));
}

type CheckBlock = {
  block: Extract<
    WalkthroughContent['stops'][number]['blocks'][number],
    { kind: 'checks' }
  >;
  step: number;
};

function checkBlocks(content: WalkthroughContent): CheckBlock[] {
  return content.stops.flatMap((stop, index) =>
    stop.blocks.flatMap((block) =>
      block.kind === 'checks' ? [{ block, step: index + 1 }] : [],
    ),
  );
}

function StepLink({ step, onJump }: { step: number; onJump: Jump }) {
  return (
    <button
      type="button"
      onClick={() => onJump(stepId(step))}
      className="shrink-0 rounded-sm text-caption leading-5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      Step {step}
    </button>
  );
}

function CheckLine({
  block,
  step,
  pull,
  live,
  onJump,
}: CheckBlock & {
  pull: WalkthroughPull;
  live: ReturnType<typeof currentWalkthroughChecks>;
  onJump: Jump;
}) {
  const recorded = recordedChecks(block.checks);
  const captured = capturedCheckNames(recorded, checksTone(block.checks));
  const rest = capturedCheckRest(captured);
  const moved = movedPullHead(pull?.detail?.headSha, block.checks.headOid);
  const names = (
    <>
      <CheckNames names={captured.names} pull={pull} />
      {rest && <span className="text-muted-foreground">{rest}</span>}
    </>
  );
  return (
    <div className="flex min-h-7 items-start gap-2 py-1 text-ui">
      <span className="flex h-5 shrink-0 items-center">
        <CheckResultIcon tone={live?.tone ?? checksTone(block.checks)} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-pretty">
        {live ? (
          <>
            <span>
              {live.label}
              {live.names.length > 0 && (
                <span className="text-muted-foreground">: </span>
              )}
              <CheckNames names={live.names} pull={pull} />
            </span>
            <span className="text-caption text-muted-foreground">
              <ShortOid label={recorded.whenWritten} />
              {captured.names.length > 0 && ': '}
              {names}
            </span>
          </>
        ) : (
          <span>
            <ShortOid label={recorded.label} />
            {captured.names.length > 0 && (
              <span className="text-muted-foreground">: </span>
            )}
            {names}
          </span>
        )}
        {moved && pull && (
          <span className="text-caption text-warn">
            #{pull.number} is now at <span className="font-mono">{moved}</span>
          </span>
        )}
      </span>
      <StepLink step={step} onJump={onJump} />
    </div>
  );
}

function Verified({
  run,
  content,
  owner,
  pull,
  checks,
  onJump,
}: {
  run: WalkthroughRun;
  content: WalkthroughContent;
  owner: ConversationScope;
  pull: WalkthroughPull;
  checks: readonly CheckBlock[];
  onJump: Jump;
}) {
  const pairs = content.stops.flatMap((stop, index) =>
    stop.blocks.flatMap((block) =>
      block.kind === 'images' ? [{ step: index + 1, block }] : [],
    ),
  );
  const notice = walkthroughEvidenceNotice(run);
  const first = pairs[0];
  return (
    <>
      {checks.map(({ block, step }) => (
        <CheckLine
          key={`checks:${step}`}
          block={block}
          step={step}
          pull={pull}
          live={undefined}
          onJump={onJump}
        />
      ))}
      {first && (
        <Line
          target={stepsLabel(pairs.map((pair) => pair.step))}
          centered
          onClick={() => onJump(stepId(first.step))}
        >
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <EvidenceThumbnails
              scope={owner.scope}
              context={owner.context}
              run={run}
              items={first.block.screenshots}
            />
            <span className="min-w-0">
              {pairs.length === 1
                ? 'Before and after screenshots'
                : `${pairs.length} before and after pairs`}
            </span>
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

const hasImages = (content: WalkthroughContent) =>
  content.stops.some((stop) =>
    stop.blocks.some((block) => block.kind === 'images'),
  );

export type BriefingScope = {
  readonly uncommitted: readonly string[];
  readonly uncovered: readonly string[];
};

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
  scope,
}: {
  run: WalkthroughRun;
  content: WalkthroughContent;
  owner: ConversationScope;
  pull: WalkthroughPull;
  onJump: Jump;
  notSaid?: ReactNode;
  comments?: ReactNode;
  scope?: BriefingScope | undefined;
}) {
  const { view } = useConversations(owner);
  const progress = callDecisionProgress(content, view?.decisions);
  const blocks = checkBlocks(content);
  const { changed, unchanged: verified } = walkthroughCheckRows(
    blocks.map((entry) => ({ ...entry, checks: entry.block.checks })),
    pull?.status,
  );
  const notes = scope
    ? walkthroughScope({
        ...scope,
        pullRequest: pull?.number,
        checkedCommit: blocks[0]?.block.checks.headOid,
      })
    : undefined;
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
      {changed.length > 0 && (
        <BriefingRow label="Checks">
          {changed.map(({ block, step, live }) => (
            <CheckLine
              key={`checks:${step}`}
              block={block}
              step={step}
              pull={pull}
              live={live}
              onJump={onJump}
            />
          ))}
        </BriefingRow>
      )}
      {(verified.length > 0 || changed.length === 0 || hasImages(content)) && (
        <BriefingRow label="Verified">
          <Verified
            run={run}
            content={content}
            owner={owner}
            pull={pull}
            checks={verified}
            onJump={onJump}
          />
        </BriefingRow>
      )}
      {(notes?.uncommitted || notes?.uncovered) && (
        <BriefingRow label="Scope">
          {notes.uncommitted && (
            <p className="py-1 text-ui text-pretty">{notes.uncommitted}</p>
          )}
          {notes.uncovered && (
            <Line
              target="Below the steps"
              onClick={() => onJump('review-not-covered')}
            >
              <span className="min-w-0 text-pretty">{notes.uncovered}</span>
            </Line>
          )}
        </BriefingRow>
      )}
      {notSaid && <BriefingRow label="Not verified">{notSaid}</BriefingRow>}
      {comments && <BriefingRow label="Comments">{comments}</BriefingRow>}
    </BriefingRows>
  );
}
