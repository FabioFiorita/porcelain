import { CommitGenerationFailedError } from '../errors/commit-generation-failed-error.ts';
import { CommitGroupsMismatchError } from '../errors/commit-groups-mismatch-error.ts';
import { CommitToolFailedError } from '../errors/commit-tool-failed-error.ts';
import { CommitToolMissingError } from '../errors/commit-tool-missing-error.ts';
import { UnsupportedCommitModelError } from '../errors/unsupported-commit-model-error.ts';
import type {
  CommitDraftGeneration,
  CommitGroup,
  CommitGroupLimits,
} from '../models/commit-draft.ts';
import type {
  GenerateCommitDraftInput,
  GenerateCommitDraftResult,
} from '../models/generate-commit-draft.ts';
import type { CommitDraftSource } from '../ports/commit-draft-source.ts';
import { commitGroupsCoverSelection } from '../rules/commit-groups-cover-selection.ts';

export class GenerateCommitDraftService {
  private readonly commitDraftSource: CommitDraftSource;
  private readonly options: CommitGroupLimits;

  constructor(
    commitDraftSource: CommitDraftSource,
    options: CommitGroupLimits,
  ) {
    this.commitDraftSource = commitDraftSource;
    this.options = options;
  }

  async execute(
    input: GenerateCommitDraftInput,
    signal?: AbortSignal,
  ): Promise<GenerateCommitDraftResult> {
    const { capture } = input;
    const groups = this.drafted(
      await this.commitDraftSource.generate(
        {
          mode: input.mode,
          model: input.model,
          paths: capture.paths,
          evidence: capture.evidence,
        },
        signal,
      ),
    );
    if (!commitGroupsCoverSelection(groups, capture, input.mode, this.options))
      throw new CommitGroupsMismatchError();
    return { groups, expectedFiles: capture.expectedFiles };
  }

  private drafted(generation: CommitDraftGeneration): CommitGroup[] {
    switch (generation.kind) {
      case 'drafted':
        return generation.groups;
      case 'unsupported-model':
        throw new UnsupportedCommitModelError();
      case 'tool-missing':
        throw new CommitToolMissingError();
      case 'tool-failed':
        throw new CommitToolFailedError();
      case 'failed':
        throw new CommitGenerationFailedError();
    }
  }
}
