import type {
  CommitDraftGeneration,
  CommitDraftRequest,
} from '../../src/models/index.ts';
import type { CommitDraftWriter } from '../../src/ports/index.ts';

export class ScriptedCommitDraftWriter implements CommitDraftWriter {
  readonly requests: CommitDraftRequest[] = [];
  private readonly generation: CommitDraftGeneration;

  constructor(generation: CommitDraftGeneration) {
    this.generation = generation;
  }

  async write(request: CommitDraftRequest): Promise<CommitDraftGeneration> {
    this.requests.push(request);
    return this.generation;
  }
}
