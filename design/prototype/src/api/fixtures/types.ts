import type { CommentAnchor } from '../../contracts/comments';
import type { Diagram, ReviewLayer, ReviewStep } from '../../contracts/review';

/** `head` is the committed content; null means the file is new in the working tree. */
/** `working` is null when the file was deleted in the working tree. */
/** `unreadable` makes the text route refuse it, as the server does for binary or oversized files. */
export type FileSeed = {
  head: string | null;
  working: string | null;
  unreadable?: 'unsupported-text' | 'too-large';
  /** A binary file: `head` and `working` are base64 bytes of this type. */
  binary?: { mime: string };
  /** In the index (`git add`): the list of changes reports it as staged. */
  staged?: boolean;
  /** Git stopped on a conflict in this file: the list of changes reports it unmerged. */
  conflict?: 'UU';
};

export type CommitSeed = {
  oid: string;
  parentOids: string[];
  subject: string;
  body?: string;
  author: string;
  minutesAgo: number;
  refs?: string[];
  /** Changes against the first parent. */
  files: { path: string; before: string | null; after: string | null }[];
  /** Mock only: a merge's changes against parent 2, 3…; a real server diffs the trees. */
  filesByParent?: Record<number, CommitSeed['files']>;
};

export type ThreadSeed = {
  id: string;
  anchor: CommentAnchor;
  resolved: boolean;
  messages: {
    author: 'reviewer' | 'agent';
    body: string;
    minutesAgo: number;
  }[];
  /** Whether the reviewer has seen every message. Default true; false leaves the last agent reply unseen. */
  seen?: boolean;
  /**
   * Mock only: the commented lines as they were, when they differ from the file now.
   * Text that is no longer in the file makes the thread outdated.
   */
  snapshot?: string;
};

/**
 * A step as the agent publishes it. `find` is text on the first line of the block
 * in the working file; the mock turns it into line numbers, so fixture code can be
 * edited without recounting.
 */
export type StepSeed = Pick<
  ReviewStep,
  'id' | 'lane' | 'title' | 'text' | 'kind'
> & {
  path: string;
  find: string;
  lines: number;
  symbol?: string;
};

export type LayerSeed = Pick<
  ReviewLayer,
  'id' | 'title' | 'summary' | 'lanes' | 'arrows'
> & {
  steps: StepSeed[];
};

export type ReviewSeed = {
  summaryHtml: string;
  diagram?: { after: Diagram; before?: Diagram };
  layers: LayerSeed[];
  minutesAgo: number;
  /** Layers the reviewer already ticked, against the code as it is now. */
  reviewedLayers?: string[];
};

export type WorktreeSeed = {
  files: Record<string, FileSeed>;
  review?: ReviewSeed;
  threads: ThreadSeed[];
  commits: CommitSeed[];
  /** .gitignore matches: an exact path, or a folder ending with `/`. */
  ignored?: string[];
  symlinks?: { path: string; target: string }[];
  submodules?: string[];
  branch: {
    upstream: string | null;
    ahead: number;
    behind: number;
  };
  /** Other local branches, for switch and create. */
  otherBranches?: string[];
};

export const unchanged = (
  files: Record<string, string>,
): Record<string, FileSeed> =>
  Object.fromEntries(
    Object.entries(files).map(([path, text]) => [
      path,
      { head: text, working: text },
    ]),
  );
