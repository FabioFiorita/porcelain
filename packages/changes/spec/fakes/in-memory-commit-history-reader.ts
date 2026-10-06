import { Effect } from 'effect';
import type {
  CommitFiles,
  CommitFilesLookup,
  CommitPage,
  CommitPatches,
  CommitPatchesRequest,
} from '../../src/models/commit-history.ts';
import type {
  FileCommits,
  ListFileCommitsInput,
} from '../../src/models/list-file-commits.ts';
import type { ReadCommitFilesInput } from '../../src/models/read-commit-files.ts';
import type { CommitHistoryReader } from '../../src/ports/commit-history-reader.ts';

const missing: CommitFilesLookup = { kind: 'missing' };
const untouched: CommitPatches = { kind: 'within-limit', patches: [] };

function found(files: CommitFiles): CommitFilesLookup {
  return { kind: 'found', files };
}

export class InMemoryCommitHistoryReader implements CommitHistoryReader {
  private readonly commits: readonly CommitFiles[];
  private readonly lookups: ReadonlyMap<string, CommitFilesLookup>;
  private readonly patches: ReadonlyMap<string, CommitPatches>;
  private readonly timelines: ReadonlyMap<string, FileCommits>;

  constructor(
    stored: {
      commits?: readonly CommitFiles[] | undefined;
      patches?: Record<string, CommitPatches> | undefined;
      timelines?: Record<string, FileCommits> | undefined;
    } = {},
  ) {
    this.commits = stored.commits ?? [];
    this.lookups = new Map(
      this.commits.map((files) => [files.commit.oid, found(files)]),
    );
    this.patches = new Map(Object.entries(stored.patches ?? {}));
    this.timelines = new Map(Object.entries(stored.timelines ?? {}));
  }

  listCommits(): Effect.Effect<CommitPage> {
    return Effect.sync(() => {
      return {
        snapshot: undefined,
        commits: this.commits.map((files) => files.commit),
        nextAfter: undefined,
        tip: undefined,
        boundary: undefined,
        restarted: false,
      };
    });
  }

  listFileCommits(input: ListFileCommitsInput): Effect.Effect<FileCommits> {
    return Effect.sync(() => {
      return this.timelines.get(input.path) ?? { commits: [], more: false };
    });
  }

  readCommitFiles(
    input: ReadCommitFilesInput,
  ): Effect.Effect<CommitFilesLookup> {
    return Effect.sync(() => {
      return this.lookups.get(input.oid) ?? missing;
    });
  }

  readCommitPatches(input: CommitPatchesRequest): Effect.Effect<CommitPatches> {
    return Effect.sync(() => {
      return this.patches.get(input.oid) ?? untouched;
    });
  }
}
