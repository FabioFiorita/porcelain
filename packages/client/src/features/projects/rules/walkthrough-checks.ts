import {
  checksHeadline,
  currentWalkthroughChecks,
  pullRequestRollup,
  recordedChecks,
  walkthroughCheckRows,
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

export function stepChecksCard(
  captured: CapturedChecks,
  pull:
    | {
        readonly status?: LiveChecks | undefined;
        readonly detail?: { readonly headSha: string } | undefined;
      }
    | undefined,
) {
  const headline = checksHeadline(captured, pull?.status);
  return {
    checks: recordedChecks(captured),
    live: currentWalkthroughChecks(captured, pull?.status),
    headline,
    lead: named(headline.label, headline.names),
    moved: movedPullHead(pull?.detail?.headSha, captured.headOid),
  };
}

type RecordedLine = {
  readonly label: string;
  readonly whenWritten: string;
  readonly more: boolean;
  readonly results: readonly {
    readonly name: string;
    readonly tone: PullChecksTone;
  }[];
};

export function capturedCheckNames(
  recorded: RecordedLine,
  written: PullChecksTone,
): {
  readonly names: readonly string[];
  readonly passing: number;
  readonly more: boolean;
} {
  const outstanding = written === 'failed' || written === 'running';
  return {
    names: recorded.results
      .filter((result) => !outstanding || result.tone === written)
      .map((result) => result.name),
    passing: outstanding
      ? recorded.results.filter((result) => result.tone === 'passed').length
      : 0,
    more: recorded.more,
  };
}

export function capturedCheckRest({
  passing,
  more,
}: {
  readonly passing: number;
  readonly more: boolean;
}) {
  return [
    passing > 0 ? ` and ${passing} passing` : '',
    more ? `${passing > 0 ? ',' : ''} and more` : '',
  ].join('');
}

export function verifiedChecksLine(
  recorded: RecordedLine,
  live:
    | { readonly label: string; readonly names: readonly string[] }
    | undefined,
  written: PullChecksTone,
): { readonly text: string; readonly captured: string | undefined } {
  const captured = capturedCheckNames(recorded, written);
  const rest = capturedCheckRest(captured);
  return live
    ? {
        text: named(live.label, live.names),
        captured: `${named(recorded.whenWritten, captured.names)}${rest}`,
      }
    : {
        text: `${named(recorded.label, captured.names)}${rest}`,
        captured: undefined,
      };
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
  const row = (
    { checks, step }: (typeof captured)[number],
    live: ReturnType<typeof currentWalkthroughChecks>,
  ) => {
    const recorded = recordedChecks(checks);
    const written = pullRequestRollup(checks.state).tone;
    const tone: PullChecksTone = live?.tone ?? written;
    return {
      step,
      recorded,
      live,
      tone,
      moved: movedPullHead(pull?.detail?.headSha, checks.headOid),
      line: verifiedChecksLine(recorded, live, written),
    };
  };
  const { changed, unchanged } = walkthroughCheckRows(captured, pull?.status);
  return {
    changed: changed.map((entry) => row(entry, entry.live)),
    unchanged: unchanged.map((entry) => row(entry, undefined)),
  };
}
