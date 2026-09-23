import { CommitGenerationFailedError } from '../errors/commit-generation-failed-error.ts';
import { CommitToolFailedError } from '../errors/commit-tool-failed-error.ts';
import { CommitToolMissingError } from '../errors/commit-tool-missing-error.ts';
import { UnsupportedCommitModelError } from '../errors/unsupported-commit-model-error.ts';
import type {
  CommitDraft,
  CommitDraftGeneration,
  CommitGroup,
} from '../models/commit-draft.ts';
import type { GenerateCommitDraftInput } from '../models/commit-draft-operations.ts';
import type { CommitDraftWriter } from '../ports/commit-draft-writer.ts';
import { commitGroupsCoverSelection } from '../rules/commit-groups-cover-selection.ts';

export class GenerateCommitDraftService {
  private readonly commitDraftWriter: CommitDraftWriter;

  constructor(commitDraftWriter: CommitDraftWriter) {
    this.commitDraftWriter = commitDraftWriter;
  }

  async execute(
    input: GenerateCommitDraftInput,
    signal?: AbortSignal,
  ): Promise<CommitDraft> {
    const { capture } = input;
    const generation = await this.commitDraftWriter.write(
      {
        mode: input.mode,
        model: input.model,
        paths: capture.paths,
        evidence: capture.evidence,
      },
      signal,
    );
    const groups = drafted(generation);
    commitGroupsCoverSelection(groups, capture, input.mode);
    return { groups, expectedFiles: capture.expectedFiles };
  }
}

function drafted(generation: CommitDraftGeneration): CommitGroup[] {
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
