import {
  walkthroughFailureCopy,
  walkthroughFileCount,
  type walkthroughPhase,
  type WalkthroughFailure,
  type WalkthroughContent,
  type WalkthroughRun,
  type WalkthroughStop,
} from './walkthrough.ts';

type Attention = NonNullable<WalkthroughStop['attention']>;
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

export function walkthroughMeta(
  run: WalkthroughRun,
  content?: WalkthroughContent,
) {
  const files = content ? walkthroughFileCount(content) : 0;
  return [
    ...(run.pullRequestNumber === undefined
      ? []
      : [`#${run.pullRequestNumber}`]),
    ...(files > 0 ? [files === 1 ? '1 file' : `${files} files`] : []),
    `written for ${run.headOid.slice(0, SHORT_OID)}${run.includesUncommitted ? ' and uncommitted work' : ''}`,
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
