import { Effect } from 'effect';
import type {
  BranchBases,
  BranchPatches,
  BranchPatchesRequest,
  BranchRangeLookup,
  BranchRangeRequest,
} from '../../src/models/branch-changes.ts';
import type { BranchRangeReader } from '../../src/ports/branch-range-reader.ts';

const noBases: BranchBases = { defaultRef: undefined, bases: [] };

export class InMemoryBranchRangeReader implements BranchRangeReader {
  private readonly ranges: ReadonlyMap<string, BranchRangeLookup>;
  private readonly patches: ReadonlyMap<string, BranchPatches>;
  private readonly bases: BranchBases;

  constructor(
    stored: {
      ranges?: Record<string, BranchRangeLookup> | undefined;
      patches?: Record<string, BranchPatches> | undefined;
      bases?: BranchBases | undefined;
    } = {},
  ) {
    this.ranges = new Map(Object.entries(stored.ranges ?? {}));
    this.patches = new Map(Object.entries(stored.patches ?? {}));
    this.bases = stored.bases ?? noBases;
  }

  readBranchRange(input: BranchRangeRequest): Effect.Effect<BranchRangeLookup> {
    return Effect.sync(() => {
      return (
        this.ranges.get(input.base ?? 'default') ?? { kind: 'missing-base' }
      );
    });
  }

  readBranchPatches(input: BranchPatchesRequest): Effect.Effect<BranchPatches> {
    return Effect.sync(() => {
      return (
        this.patches.get(`${input.baseOid}..${input.headOid}`) ?? {
          kind: 'missing',
        }
      );
    });
  }

  listBranchBases(): Effect.Effect<BranchBases> {
    return Effect.sync(() => {
      return this.bases;
    });
  }
}
