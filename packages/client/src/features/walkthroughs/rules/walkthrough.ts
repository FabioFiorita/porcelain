import type {
  readWalkthroughResponseSchema,
  walkthroughContentSchema,
} from '@porcelain/contracts/walkthroughs';

export type WalkthroughRead = typeof readWalkthroughResponseSchema.Type;
export type WalkthroughRun = NonNullable<WalkthroughRead['walkthrough']>;
export type WalkthroughContent = typeof walkthroughContentSchema.Type;
export type WalkthroughStop = WalkthroughContent['stops'][number];
export type WalkthroughEvidence = WalkthroughStop['evidence'][number];
export type WalkthroughFailure = Extract<
  WalkthroughRun['state'],
  { status: 'failed' }
>['failure'];
export type WalkthroughWriter = WalkthroughRun['writer'];

export type WalkthroughPhase =
  | { kind: 'unwritten' }
  | { kind: 'writing'; run: WalkthroughRun }
  | { kind: 'failed'; run: WalkthroughRun; failure: WalkthroughFailure }
  | {
      kind: 'ready';
      run: WalkthroughRun;
      content: WalkthroughContent;
      outOfDate: boolean;
      attempt?: WalkthroughRun | undefined;
    };

export function walkthroughPhase(read: WalkthroughRead): WalkthroughPhase {
  const run = read.walkthrough;
  if (run === undefined) return { kind: 'unwritten' };
  switch (run.state.status) {
    case 'queued':
    case 'running':
      return { kind: 'writing', run };
    case 'failed':
      return { kind: 'failed', run, failure: run.state.failure };
    case 'ready':
      return {
        kind: 'ready',
        run,
        content: run.state.content,
        outOfDate: read.outOfDate,
        attempt: read.attempt,
      };
  }
}

export type FirstDocument = 'walkthrough' | 'review' | 'changes';

export function firstDocument(input: {
  read: WalkthroughRead;
  publishedReview: boolean;
  branchHasCommits: boolean;
}): FirstDocument {
  if (input.read.walkthrough !== undefined) return 'walkthrough';
  if (input.publishedReview) return 'review';
  return input.branchHasCommits ? 'walkthrough' : 'changes';
}

const CALL_WORDS = ['One', 'Two', 'Three', 'Four', 'Five'];

export function walkthroughCalls(content: WalkthroughContent) {
  return content.stops.flatMap((stop, index) =>
    stop.attention === undefined
      ? []
      : [{ stop, step: index + 1, attention: stop.attention }],
  );
}

export function walkthroughVerdict(content: WalkthroughContent) {
  const calls = walkthroughCalls(content).length;
  if (content.outcome === 'nothing') return 'Nothing needs you.';
  if (content.outcome === 'worth_knowing' || calls === 0)
    return 'Worth knowing.';
  if (calls === 1) return 'One call is yours.';
  return `${CALL_WORDS[calls - 1] ?? calls} calls are yours.`;
}

type ChangedFile = { path: string; oldPath?: string | undefined };

export function stopPaths(
  stop: WalkthroughStop,
  renames: readonly ChangedFile[] = [],
): readonly string[] {
  const cited = [
    ...stop.excerpts.map((excerpt) => excerpt.path),
    ...stop.files.map((file) => file.path),
  ];
  const renamed = renames.flatMap((file) =>
    file.oldPath !== undefined && cited.includes(file.oldPath)
      ? [file.path]
      : [],
  );
  return [...new Set([...cited, ...renamed])];
}

export function walkthroughFileCount(content: WalkthroughContent) {
  return new Set(content.stops.flatMap((stop) => stopPaths(stop))).size;
}

function fileInPaths(paths: ReadonlySet<string>, file: ChangedFile) {
  return (
    paths.has(file.path) ||
    (file.oldPath !== undefined && paths.has(file.oldPath))
  );
}

export type StepFiles<File> = {
  stop: WalkthroughStop;
  step: number;
  files: readonly File[];
};

export function groupFilesByStep<File extends ChangedFile>(
  content: WalkthroughContent,
  files: readonly File[],
  renames: readonly ChangedFile[] = [],
): { steps: readonly StepFiles<File>[]; outside: readonly File[] } {
  const owned = new Set<File>();
  const steps = content.stops.map((stop, index) => {
    const paths = new Set(stopPaths(stop, renames));
    const inStep = files.filter((file) => fileInPaths(paths, file));
    for (const file of inStep) owned.add(file);
    return { stop, step: index + 1, files: inStep };
  });
  return { steps, outside: files.filter((file) => !owned.has(file)) };
}

export type FailureCopy = {
  title: string;
  message: string;
  command?: string;
};

const WRITER_NAMES: Record<WalkthroughWriter['provider'], string> = {
  claude: 'Claude',
  codex: 'Codex',
};

const SIGN_IN_COMMANDS: Record<WalkthroughWriter['provider'], string> = {
  claude: 'claude auth login',
  codex: 'codex login',
};

export function walkthroughFailureCopy(
  failure: WalkthroughFailure,
  writer: WalkthroughWriter,
): FailureCopy {
  const name = WRITER_NAMES[writer.provider];
  switch (failure.kind) {
    case 'signed_out':
      return {
        title: `Sign in to ${name} again with ${SIGN_IN_COMMANDS[writer.provider]}, then try again.`,
        message: '',
        command: SIGN_IN_COMMANDS[writer.provider],
      };
    case 'agent_not_installed':
      return {
        title: `${name} isn't installed here.`,
        message: failure.message,
      };
    case 'timed_out':
      return {
        title: 'The walkthrough took too long.',
        message: failure.message,
      };
    case 'unusable_output':
      return {
        title: `${name} wrote something unreadable.`,
        message: failure.message,
      };
    case 'other':
      return {
        title: "The walkthrough didn't finish.",
        message: failure.message,
      };
  }
}

const FAILURE_KINDS: ReadonlySet<string> = new Set([
  'signed_out',
  'agent_not_installed',
  'timed_out',
  'unusable_output',
  'other',
] satisfies WalkthroughFailure['kind'][]);

function isFailureKind(kind: unknown): kind is WalkthroughFailure['kind'] {
  return typeof kind === 'string' && FAILURE_KINDS.has(kind);
}

export function walkthroughStartFailure(error: unknown): WalkthroughFailure {
  if (
    typeof error === 'object' &&
    error !== null &&
    'kind' in error &&
    'message' in error &&
    isFailureKind(error.kind) &&
    typeof error.message === 'string'
  )
    return { kind: error.kind, message: error.message };
  return {
    kind: 'other',
    message:
      error instanceof Error && error.message !== ''
        ? error.message
        : 'Porcelain could not start the walkthrough.',
  };
}

export function walkthroughPullRequest(
  pulls: readonly { number: number; headBranch: string; state: string }[],
  branch: string | undefined,
) {
  if (branch === undefined) return undefined;
  return pulls.find(
    (pull) => pull.headBranch === branch && pull.state === 'open',
  )?.number;
}

export function walkthroughTabTitle(read: WalkthroughRead) {
  const phase = walkthroughPhase(read);
  return phase.kind === 'ready'
    ? plainText(phase.content.title).replace(/\.$/, '')
    : 'Walkthrough';
}

export function plainText(text: string) {
  return text.replaceAll('`', '');
}

export type RichPart =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string };

export function richParts(text: string): readonly RichPart[] {
  return text
    .split(/(`[^`]+`)/)
    .filter((part) => part !== '')
    .map((part) =>
      part.length > 2 && part.startsWith('`') && part.endsWith('`')
        ? { kind: 'code', text: part.slice(1, -1) }
        : { kind: 'text', text: part },
    );
}
