export type PlaygroundProfileName = 'fixture' | 'app' | 'monorepo';

/** Git results a playground aims for, counted the way Porcelain reads them. */
export type PlaygroundTargets = {
  /** Files tracked on main, Fieldnotes story included. */
  trackedFiles: number;
  /** Commits reachable from main, Fieldnotes story included. */
  commits: number;
  /** Branches on the local bare remote, main and review included. */
  remoteBranches: number;
  worktrees: number;
  /** `git status --untracked-files=all` entries per worktree. */
  changedEntries: { review: number; agents: readonly number[] };
  /** Ignored files (dependencies and build output) in every worktree. */
  ignoredFilesPerWorktree: number;
};

/**
 * Synthetic history generated beneath the Fieldnotes story. Counts exclude the
 * story, whose files stay at the repository root and whose commits stay newest.
 */
export type SyntheticShape = {
  seed: number;
  files: number;
  directories: number;
  /** package.json files, the workspace root included. */
  packages: number;
  medianDepth: number;
  maxDepth: number;
  medianFileBytes: number;
  p90FileBytes: number;
  /** Text files between 100 KB and 1 MB. */
  largeFiles: number;
  /** Text files above 1 MB besides the lockfile; the largest is maxFileBytes. */
  multiMegabyteFiles: number;
  maxFileBytes: number;
  lockfileBytes: number;
  binaryFiles: number;
  commits: number;
  /** Share of commits that merge a feature branch. */
  mergeShare: number;
  /** Refactors touching 50 or more files. */
  largeCommits: number;
  lockfileUpdates: number;
  historyDays: number;
  remoteBranches: number;
  reviewChanges: number;
  agentChanges: readonly number[];
  ignoredFiles: number;
};

export type PlaygroundProfile = {
  label: string;
  description: string;
  targets: PlaygroundTargets;
  synthetic?: SyntheticShape;
};

// The curated Fieldnotes story adds these on top of any synthetic history.
const storyTrackedFiles = 11;
const storyCommits = 5;
const storyRemoteBranches = 2;
const curatedReviewChanges = 7;

export function syntheticTargets(shape: SyntheticShape): PlaygroundTargets {
  return {
    trackedFiles: shape.files + storyTrackedFiles,
    commits: shape.commits + storyCommits,
    remoteBranches: shape.remoteBranches + storyRemoteBranches,
    worktrees: 2 + shape.agentChanges.length,
    changedEntries: {
      review: shape.reviewChanges + curatedReviewChanges,
      agents: shape.agentChanges,
    },
    ignoredFilesPerWorktree: shape.ignoredFiles,
  };
}

const app: SyntheticShape = {
  seed: 1,
  files: 990,
  directories: 130,
  packages: 6,
  medianDepth: 4.9,
  maxDepth: 7,
  medianFileBytes: 1_800,
  p90FileBytes: 8_000,
  largeFiles: 3,
  multiMegabyteFiles: 1,
  maxFileBytes: 2_200_000,
  lockfileBytes: 900_000,
  binaryFiles: 10,
  commits: 1_995,
  mergeShare: 0.15,
  largeCommits: 8,
  lockfileUpdates: 30,
  historyDays: 730,
  remoteBranches: 4,
  reviewChanges: 150,
  agentChanges: [40],
  ignoredFiles: 60_000,
};

const monorepo: SyntheticShape = {
  seed: 2,
  files: 19_990,
  directories: 4_000,
  packages: 150,
  medianDepth: 6.9,
  maxDepth: 13,
  medianFileBytes: 2_000,
  p90FileBytes: 12_000,
  largeFiles: 200,
  multiMegabyteFiles: 6,
  maxFileBytes: 12_000_000,
  lockfileBytes: 2_500_000,
  binaryFiles: 900,
  commits: 49_995,
  mergeShare: 0.2,
  largeCommits: 60,
  lockfileUpdates: 40,
  historyDays: 2_200,
  remoteBranches: 198,
  reviewChanges: 100,
  agentChanges: [0, 50, 400],
  ignoredFiles: 400_000,
};

export const playgroundProfiles: Record<
  PlaygroundProfileName,
  PlaygroundProfile
> = {
  fixture: {
    label: 'Fixture',
    description:
      'The small Fieldnotes sample: every review scenario, starts instantly.',
    targets: {
      trackedFiles: 12,
      commits: 5,
      remoteBranches: 2,
      worktrees: 2,
      changedEntries: { review: curatedReviewChanges, agents: [] },
      ignoredFilesPerWorktree: 0,
    },
  },
  app: {
    label: 'App',
    description:
      'A mid-size application with years of history, an agent worktree and installed dependencies.',
    targets: syntheticTargets(app),
    synthetic: app,
  },
  monorepo: {
    label: 'Monorepo',
    description:
      'A large workspace monorepo with deep history, many branches and busy agent worktrees.',
    targets: syntheticTargets(monorepo),
    synthetic: monorepo,
  },
};

export function isPlaygroundProfileName(
  value: string,
): value is PlaygroundProfileName {
  return Object.hasOwn(playgroundProfiles, value);
}
