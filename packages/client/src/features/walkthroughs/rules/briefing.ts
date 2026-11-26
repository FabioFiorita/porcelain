import type { StepBlock } from './blocks.ts';
import { screenshotClaim } from './page.ts';
import type { WalkthroughContent, WalkthroughRun } from './walkthrough.ts';

type ListedPull = {
  readonly number: number;
  readonly headBranch: string;
  readonly state: string;
};

export function walkthroughPullRequest<P extends ListedPull>(
  listed: readonly P[],
  run: Pick<WalkthroughRun, 'branch' | 'pullRequestNumber'>,
): P | undefined {
  const branch = listed.filter((pull) => pull.headBranch === run.branch);
  return (
    branch.find((entry) => entry.state === 'open') ??
    listed.find((entry) => entry.number === run.pullRequestNumber) ??
    branch[0]
  );
}

const SHORT_OID = 7;

type CapturedChecks = Extract<StepBlock, { kind: 'checks' }>['checks'];

function stepsLabel(steps: readonly number[]) {
  const unique = [...new Set(steps)];
  return unique.length === 1
    ? `Step ${unique[0]}`
    : `Steps ${unique.join(', ')}`;
}

export function walkthroughVerified(content: WalkthroughContent): {
  readonly checks: readonly { checks: CapturedChecks; step: number }[];
  readonly screenshots:
    | { text: string; steps: string; first: number }
    | undefined;
} {
  const checks = content.stops.flatMap((stop, index) =>
    stop.blocks.flatMap((block) =>
      block.kind === 'checks'
        ? [{ checks: block.checks, step: index + 1 }]
        : [],
    ),
  );
  const pairs = content.stops.flatMap((stop, index) =>
    stop.blocks.flatMap((block) =>
      block.kind === 'images'
        ? [{ step: index + 1, screenshots: block.screenshots }]
        : [],
    ),
  );
  const first = pairs[0];
  return {
    checks,
    screenshots:
      first === undefined
        ? undefined
        : {
            text:
              pairs.length === 1
                ? screenshotClaim(first.screenshots)
                : `${pairs.length} before and after pairs`,
            steps: stepsLabel(pairs.map((pair) => pair.step)),
            first: first.step,
          },
  };
}

export function nothingCaptured(run: Pick<WalkthroughRun, 'headOid'>) {
  return `No checks or screenshots were captured for ${run.headOid.slice(0, SHORT_OID)}.`;
}

type Decision = {
  readonly step: number;
  readonly call: number;
  readonly option?: string | undefined;
  readonly decidedBy: { readonly kind: string };
  readonly decidedAt: string;
};

export function callDecision<D extends Decision>(
  decisions: readonly D[] | undefined,
  step: number,
  call: number,
): D | undefined {
  return decisions?.find((entry) => entry.step === step && entry.call === call);
}

export function decidedWhen(at: string): string {
  return new Date(at).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function callDecisionRequest(input: {
  readonly step: number;
  readonly call: number;
  readonly decided: boolean;
  readonly option?: string | undefined;
}) {
  const { step, call } = input;
  return input.decided
    ? {
        step,
        call,
        decided: true as const,
        ...(input.option === undefined ? {} : { option: input.option }),
      }
    : { step, call, decided: false as const };
}

export function decisionAuthor(decision: {
  readonly decidedBy: { readonly kind: string };
}) {
  return decision.decidedBy.kind === 'owner'
    ? 'by the owner'
    : 'from a paired device';
}

export function decidedOption(decision: {
  readonly option?: string | undefined;
}) {
  return decision.option === undefined
    ? 'Decided'
    : `Decided: ${decision.option}`;
}
