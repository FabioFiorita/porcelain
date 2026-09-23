import type {
  GitActionExpectation,
  GitActionIntent,
  GitActionOutcome,
  GitActionReceipt,
} from '../models/git-action.ts';

export interface ActionChangeReaderPort {
  allFingerprints(): Promise<ReadonlyMap<string, string | null>>;
  fingerprints(paths: readonly string[]): Promise<ReadonlyMap<string, string>>;
}

export interface ActionExecutionPort {
  run(
    receipt: GitActionReceipt,
    intent: GitActionIntent,
    expected: GitActionExpectation,
    signal: AbortSignal,
    onProgress: ((line: string) => void) | undefined,
    verifyTarget: (changes: ActionChangeReaderPort) => Promise<void>,
  ): Promise<GitActionOutcome>;
}
