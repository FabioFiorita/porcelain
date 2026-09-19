/**
 * PROPOSED in full (server review, section 4). Replaces review-layers.ts and the
 * handoff artifacts. The agent publishes a review with `publish_review`: a summary
 * page, an optional diagram and the layers. It replaces the whole review with the
 * revision it last saw; only the latest review is kept.
 *
 * GET /worktrees/:worktreeId/review answers the review, or 204 when there is none
 * or when nothing it describes is uncommitted any more (it hides until the agent
 * publishes again). Clients read it once on open, then when the live channel says
 * the revision moved.
 */

/** Where a step points, as published. Lines are 1-based and inclusive. */
export type CodePointer = {
  path: string;
  startLine: number;
  endLine: number;
  /** The function or other symbol the lines belong to, when the agent knows it. */
  symbol?: string;
};

/**
 * Where the server finds a step's code now, re-found on every read from the lines,
 * the symbol and a fingerprint of the text it stored at publish time.
 * - `current`: found, at the same lines or moved (the lines say where).
 * - `changed`: not found any more: "Code changed since the review was written".
 * - `committed`: found, but no longer uncommitted: the step folds away.
 */
export type StepLocation =
  | { state: 'current'; startLine: number; endLine: number }
  | { state: 'changed' }
  | { state: 'committed'; startLine: number; endLine: number };

export type ReviewStep = {
  id: string;
  /** Index into the layer's `lanes`; shown as the step's small label. */
  lane: number;
  /** Usually the function name. */
  title: string;
  /** One or two sentences, Markdown. */
  text: string;
  /** A changed step shows its block as a diff; a context step shows unchanged code. */
  kind: 'changed' | 'context';
  pointer: CodePointer;
  location: StepLocation;
};

/** One behaviour told from start to end. */
export type ReviewLayer = {
  id: string;
  title: string;
  /** One line under the title. */
  summary: string;
  /** The stages the layer passes through, e.g. web hook → route → use case → storage. */
  lanes: string[];
  steps: ReviewStep[];
  /** Extra arrows for branches or callbacks; the step order already draws the main path. */
  arrows?: { from: string; to: string; label?: string }[];
  /** Computed by the server from the code its changed steps cover. A layer mark stores it. */
  fingerprint: string;
};

export type DiagramBox = {
  id: string;
  /** Index into the diagram's `lanes`. */
  lane: number;
  label: string;
  detail?: string;
  kind: 'actor' | 'component' | 'storage' | 'transport' | 'credential';
  /** After view: how this box compares with before. */
  change?: 'new' | 'changed' | 'removed';
  /** Before view: what was wrong. */
  problem?: string;
  /** The layer that builds this box; clicking the box opens it. */
  layerId?: string;
};

export type Diagram = {
  lanes: string[];
  boxes: DiagramBox[];
  arrows: { from: string; to: string; label?: string; dashed?: boolean }[];
};

/**
 * Changed lines (new side) that no changed step explains. Blank lines, imports,
 * comments and lone closing brackets do not count, and a step covering part of a
 * paragraph explains that paragraph. A deleted or binary file has no ranges.
 */
export type NotExplained = {
  path: string;
  ranges: { startLine: number; endLine: number }[];
  deleted?: boolean;
  /** A binary file (an image): no step can point at its lines, so it is always listed. */
  binary?: boolean;
};

export type ReviewResponse = {
  worktreeId: string;
  revision: number;
  publishedAt: string;
  /**
   * The agent's HTML page, served from its own signed link (about an hour) with the
   * header `Content-Security-Policy: sandbox allow-scripts allow-forms allow-popups
   * allow-modals`: a blank identity, so it cannot reach Porcelain's login, storage or
   * API, while scripts, CDNs and fonts load freely. Append `#theme=light|dark`; the
   * server injects the theme tokens and turns `#layer-N` links into a message to the
   * parent page.
   */
  summary: { url: string; byteLength: number };
  /** Optional: the agent draws one when the change touches more than one part of the system. */
  diagram?: { after: Diagram; before?: Diagram };
  layers: ReviewLayer[];
  notExplained: NotExplained[];
};

/** What the summary page posts to Porcelain when a `#layer-N` link is clicked (N is 1-based). */
export type SummaryMessage = { source: 'porcelain-summary'; openLayer: number };
