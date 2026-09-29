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

  readBranchRange(input: BranchRangeRequest): Promise<BranchRangeLookup> {
    return Promise.resolve(
      this.ranges.get(input.base ?? 'default') ?? { kind: 'missing-base' },
    );
  }

  readBranchPatches(input: BranchPatchesRequest): Promise<BranchPatches> {
    return Promise.resolve(
      this.patches.get(`${input.baseOid}..${input.headOid}`) ?? {
        kind: 'missing',
      },
    );
  }

  listBranchBases(): Promise<BranchBases> {
    return Promise.resolve(this.bases);
  }
}
