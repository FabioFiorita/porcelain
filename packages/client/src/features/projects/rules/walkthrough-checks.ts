import {
  type currentWalkthroughChecks,
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

export function verifiedChecksLine(
  recorded: {
    readonly label: string;
    readonly whenWritten: string;
    readonly more: boolean;
    readonly results: readonly {
      readonly name: string;
      readonly tone: PullChecksTone;
    }[];
  },
  live:
    | { readonly label: string; readonly names: readonly string[] }
    | undefined,
  written: PullChecksTone,
): { readonly text: string; readonly captured: string | undefined } {
  const outstanding = written === 'failed' || written === 'running';
  const names = recorded.results
    .filter((result) => !outstanding || result.tone === written)
    .map((result) => result.name);
  const more = recorded.more ? ' and more' : '';
  return live
    ? {
        text: named(live.label, live.names),
        captured: `${named(recorded.whenWritten, names)}${more}`,
      }
    : { text: `${named(recorded.label, names)}${more}`, captured: undefined };
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
