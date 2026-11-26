import {
  currentWalkthroughChecks,
  pullRequestRollup,
  recordedChecks,
  type PullChecksTone,
} from './pull-request.ts';

const SHORT_OID = 7;

type CapturedChecks = Parameters<typeof recordedChecks>[0];
type LiveChecks = NonNullable<Parameters<typeof currentWalkthroughChecks>[1]>;

export function movedPullHead(
  pullHead: string | undefined,
  capturedHead: string,
): string | undefined {
  return pullHead !== undefined && pullHead !== capturedHead
    ? pullHead.slice(0, SHORT_OID)
    : undefined;
}

const named = (label: string, names: readonly string[]) =>
  names.length > 0 ? `${label}: ${names.join(', ')}` : label;

export function verifiedChecksLine(
  recorded: {
    readonly label: string;
    readonly more: boolean;
    readonly results: readonly { readonly name: string }[];
  },
  live:
    | { readonly label: string; readonly names: readonly string[] }
    | undefined,
): { readonly text: string; readonly captured: string | undefined } {
  const captured = `${named(
    recorded.label,
    recorded.results.map((result) => result.name),
  )}${recorded.more ? ' and more' : ''}`;
  return live
    ? { text: named(live.label, live.names), captured: `Captured: ${captured}` }
    : { text: captured, captured: undefined };
}

export function verifiedChecks(
  captured: readonly {
    readonly checks: CapturedChecks;
    readonly step: number;
  }[],
  pull:
    | {
        readonly status: LiveChecks | undefined;
        readonly detail: { readonly headSha: string } | undefined;
      }
    | undefined,
) {
  return captured.map(({ checks, step }) => {
    const recorded = recordedChecks(checks);
    const live = currentWalkthroughChecks(checks, pull?.status);
    const tone: PullChecksTone =
      live?.tone ?? pullRequestRollup(checks.state).tone;
    return {
      step,
      recorded,
      live,
      tone,
      moved: movedPullHead(pull?.detail?.headSha, checks.headOid),
      line: verifiedChecksLine(recorded, live),
    };
  });
}
