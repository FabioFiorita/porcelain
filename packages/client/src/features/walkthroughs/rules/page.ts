import {
  walkthroughCalls,
  walkthroughFailureCopy,
  walkthroughFileCount,
  type walkthroughPhase,
  type WalkthroughFailure,
  type WalkthroughContent,
  type WalkthroughRun,
} from './walkthrough.ts';
import type { WalkthroughScreenshot, WalkthroughStop } from './blocks.ts';

type Attention = WalkthroughStop['callouts'][number]['attention'];
type Growth = WalkthroughContent['growth'][number];

const ATTENTION_LABELS: Record<Attention['kind'], string> = {
  product: 'Product call',
  contract: 'Contract call',
  tradeoff: 'Tradeoff',
  risk: 'Risk to accept',
  accessibility: 'Accessibility call',
};

export function attentionLabel(attention: Attention) {
  return ATTENTION_LABELS[attention.kind];
}

type Comparison = WalkthroughStop['callouts'][number]['comparison'];

export const NEEDS_A_COMMIT =
  'Needs a new commit: this change does not do this yet.';

export function callDeciding(comparison: Comparison) {
  return comparison?.implemented === undefined
    ? 'Choosing records your call, and Merge stops waiting for it. Porcelain changes no code.'
    : 'Choosing records your call. Merge stops waiting for it unless the call needs a new commit. Porcelain changes no code.';
}

export function callChoices(comparison: Comparison) {
  const implemented = comparison?.implemented;
  return (comparison?.columns ?? []).map((option) => ({
    option,
    implemented: option === implemented,
    effect:
      implemented === undefined
        ? undefined
        : option === implemented
          ? 'Keeps the code as it is.'
          : NEEDS_A_COMMIT,
  }));
}

export function screenshotClaim(screenshots: readonly WalkthroughScreenshot[]) {
  return (
    screenshots.find((screenshot) => screenshot.label === 'After')?.shows ??
    'Before and after screenshots'
  );
}

export function decidedAgainstChange(
  comparison: Comparison,
  option: string | undefined,
) {
  const implemented = comparison?.implemented;
  return (
    option !== undefined && implemented !== undefined && option !== implemented
  );
}

type DecidedOption = {
  readonly step: number;
  readonly call: number;
  readonly option?: string | undefined;
};

export function callsNeedingCommit(
  content: WalkthroughContent,
  decisions: readonly DecidedOption[] | undefined,
) {
  return walkthroughCalls(content)
    .filter((call) =>
      decidedAgainstChange(
        call.comparison,
        decisions?.find(
          (entry) => entry.step === call.step && entry.call === call.callIndex,
        )?.option,
      ),
    )
    .map((call) => call.step);
}

const GROWTH_SIGNS: Record<Growth['change'], string> = {
  added: '+',
  changed: '~',
  removed: '−',
};

export function growthSign(growth: Growth) {
  return GROWTH_SIGNS[growth.change];
}

const GROWTH_SHOWN = 4;
const SHORT_OID = 7;
const NOT_SAID_SHOWN = 3;

export function foldedGrowth(content: WalkthroughContent, open: boolean) {
  const items = content.growth;
  return {
    shown: open ? items : items.slice(0, GROWTH_SHOWN),
    hidden: open ? 0 : Math.max(0, items.length - GROWTH_SHOWN),
  };
}

export function foldedNotSaid(content: WalkthroughContent, open: boolean) {
  const total = content.onlyInTranscript.length + content.stillUnclear.length;
  const explained = open
    ? content.onlyInTranscript
    : content.onlyInTranscript.slice(0, NOT_SAID_SHOWN);
  const unclear = open
    ? content.stillUnclear
    : content.stillUnclear.slice(
        0,
        Math.max(0, NOT_SAID_SHOWN - explained.length),
      );
  return {
    explained,
    unclear,
    total,
    hidden: total - explained.length - unclear.length,
  };
}

export type MetaFiles = {
  readonly committed: readonly string[];
  readonly uncommitted: readonly string[];
};

const fileCount = (count: number) =>
  count === 1 ? '1 file' : `${count} files`;

function filesLabel(
  content: WalkthroughContent | undefined,
  files: MetaFiles | null | undefined,
) {
  if (files === null) return undefined;
  if (files === undefined) {
    const cited = content ? walkthroughFileCount(content) : 0;
    return cited === 0 ? undefined : fileCount(cited);
  }
  const committed = new Set(files.committed);
  const local = new Set(
    files.uncommitted.filter((path) => !committed.has(path)),
  ).size;
  const total = committed.size + local;
  if (total === 0) return undefined;
  return `${fileCount(total)}${local > 0 ? `, ${local} uncommitted` : ''}`;
}

export function walkthroughMeta(
  run: WalkthroughRun,
  content?: WalkthroughContent,
  writerModel?: string,
  files?: MetaFiles | null,
) {
  const label = filesLabel(content, files);
  return [
    ...(run.pullRequestNumber === undefined
      ? []
      : [`#${run.pullRequestNumber}`]),
    ...(label === undefined ? [] : [label]),
    `written for ${run.headOid.slice(0, SHORT_OID)}${run.includesUncommitted ? ' and uncommitted work' : ''}`,
    ...(writerModel === undefined
      ? []
      : [`by ${writerModel}`, `${run.writer.effort} effort`]),
  ].join(' · ');
}

export function failureCopy(
  failure: WalkthroughFailure,
  run: WalkthroughRun | undefined,
) {
  return walkthroughFailureCopy(
    failure,
    run?.writer ?? { provider: 'claude', model: '', effort: 'high' },
  );
}

export function initialWriteFailure(
  phase: ReturnType<typeof walkthroughPhase>,
  failure: WalkthroughFailure | undefined,
) {
  if (!failure || (phase.kind !== 'unwritten' && phase.kind !== 'failed'))
    return undefined;
  return {
    failure,
    run: phase.kind === 'failed' ? phase.run : undefined,
  };
}

type ReadyPhase = Extract<
  ReturnType<typeof walkthroughPhase>,
  { kind: 'ready' }
>;

export type UpdateFailure = {
  failure: WalkthroughFailure;
  writer: WalkthroughRun['writer'];
};

export function readyUpdate(
  phase: ReadyPhase,
  start: { waiting: boolean; failure: WalkthroughFailure | undefined },
): { updating: boolean; failure: UpdateFailure | undefined } {
  const attempt = phase.attempt;
  const status = attempt?.state.status;
  const failed =
    attempt?.state.status === 'failed'
      ? { failure: attempt.state.failure, writer: attempt.writer }
      : undefined;
  return {
    updating: start.waiting || status === 'queued' || status === 'running',
    failure: start.failure
      ? {
          failure: start.failure,
          writer: attempt?.writer ?? phase.run.writer,
        }
      : failed,
  };
}

export function walkthroughEvidenceNotice(run: WalkthroughRun) {
  switch (run.evidenceUnavailable) {
    case 'head_mismatch':
      return 'Screenshots and checks are not shown: the pull request is at another commit. Push, then update.';
    case 'github_account':
      return 'Screenshots and checks are not shown: choose a GitHub account for this project, then update.';
    case 'github_unavailable':
      return 'Screenshots and checks are not shown: GitHub could not be reached. Try updating later.';
    case undefined:
      return undefined;
  }
}

function fileNames(paths: readonly string[]) {
  const names = paths.map((path) => path.split('/').at(-1) ?? path);
  const shown = names.slice(0, 3);
  const more = names.length - shown.length;
  if (more > 0) return `${shown.join(', ')} and ${more} more`;
  const last = shown.pop();
  return shown.length > 0 ? `${shown.join(', ')} and ${last}` : (last ?? '');
}

export function walkthroughScope({
  uncommitted,
  uncovered,
  pullRequest,
  checkedCommit,
}: {
  uncommitted: readonly string[];
  uncovered: readonly string[];
  pullRequest: number | undefined;
  checkedCommit: string | undefined;
}) {
  const outside =
    pullRequest === undefined ? '' : `, so not in #${pullRequest}`;
  const checks =
    checkedCommit === undefined
      ? ''
      : ` The checks cover ${checkedCommit.slice(0, SHORT_OID)} only.`;
  return {
    uncommitted:
      uncommitted.length === 0
        ? undefined
        : `${fileNames(uncommitted)} ${uncommitted.length === 1 ? 'is' : 'are'} uncommitted${outside}.${checks}`,
    uncovered:
      uncovered.length === 0
        ? undefined
        : `No step covers ${fileNames(uncovered)}.`,
  };
}
