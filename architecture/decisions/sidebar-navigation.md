# Decision: separate the review queue from checkout navigation

Status: proposed. Approval covers the navigation model and read-only summary shape described below. No production implementation, migration, connection recovery change, or deletion is included.

## Problem and recommended behavior

The navigator currently combines saved reviews and live checkouts, groups main checkouts under No review, and hides computer names in its main rows. Different computers, repository registrations and checkouts can legitimately share labels. A repeated name is not evidence of duplicated data.

Use two views in the existing sidebar: Reviews and Worktrees. Reviews retains the review-status queue and leads with the published task. Worktrees contains every checkout, grouped by environment-scoped project, and leads with the branch; detached checkouts lead with their folder. The existing search button becomes one cross-view search. No repository or checkout is merged or removed based on its name.

Review rows show project, computer and a distinguishing publishing-folder suffix below the task. Worktree group headers show project and computer; same-name projects on one computer also show their distinguishing root suffix. Worktree rows show a shortest distinguishing path suffix below the branch, even when not selected. Main, detached and unavailable are explicit secondary states. Long identities use stock Item xs with a two-line description when necessary; compact two-line rows use stock SidebarMenuButton lg. Never change primitive padding, type sizes, colors or radii. Full identity is available by keyboard focus, hover and an explicit Details action suitable for touch.

The current checkout remains visible below either view. Switching views, filtering, searching, or reading identity details does not select a different target. Clicking a review always opens its durable review route; clicking a checkout opens its exact workspace route. Existing unsaved-document protection remains the gate for navigation. Back, Settings return and reload preserve the exact environment-qualified target. Search can reveal a selected result without rewriting the saved scope or collapse state.

## Identity and lifecycle

- Environment identity is the server's environmentId. Labels and addresses are presentation, not keys.
- Project identity is environmentId + projectId. Project registration already reuses the physical repository identity; no cross-computer repository equivalence is invented here.
- Checkout identity is environmentId + projectId + worktreeId. The existing worktreeId derives from project identity and Git administrative metadata identity. Branch and path are labels, never substitute keys.
- Review identity is environmentId + reviewId. Existing durable ownership remains project + branch or linked PR. A revision's publishing checkout is an attachment, not the review's identity.
- Match a publishing checkout by stored worktreeId and projectId. If it is absent, show Checkout missing. If its branch changed, show Checkout changed branch and keep the review readable. Do not attach another checkout merely because branch or path matches.
- Closed means explicitly closed, archived, or confirmed linked PR closed/merged. Archived remains distinct and readable. No grouping operation archives a review or removes a checkout.
- A closed review does not hide a retained checkout from Worktrees. A main-checkout review is visible in Reviews. These replace the current suppression rules.

## Usage first

The following are sketches, not executable exports or a committed wire contract.

```ts
type CheckoutRef = {
  readonly environmentId: string;
  readonly projectId: string;
  readonly worktreeId: string;
};

type ReviewRef = {
  readonly environmentId: string;
  readonly reviewId: string;
};

type NavigationSelection =
  | { readonly kind: 'checkout'; readonly target: CheckoutRef }
  | { readonly kind: 'review'; readonly target: ReviewRef };

function openNavigation(selection: NavigationSelection): Promise<void> {
  throw new Error('not implemented');
}

openNavigation({
  kind: 'checkout',
  target: {
    environmentId: 'environment-a',
    projectId: 'project-a',
    worktreeId: 'checkout-b',
  },
});

openNavigation({
  kind: 'review',
  target: { environmentId: 'environment-b', reviewId: 'review-c' },
});
```

Both apps consume one shared client navigation projection. Web renders the sidebar and keyboard search; native renders Worktrees and its workspace picker. The web and native adapters call their existing route/selection owners. Search is a projection over summaries and inventories, not a second selection store.

## Shape 1: extend the existing per-project review list (recommended)

Keep GET /api/inventory and GET /api/projects/:projectId/reviews. Extend each existing review-list record with latest publication metadata and small review state. Keep existing record fields; do not add a second review collection or new aggregate endpoint.

```ts
type LatestReviewNavigation = {
  readonly title: string;
  readonly worktreeId: string;
  readonly worktreePath: string;
  readonly publishedAt: string;
  readonly reviewedDecisions: number;
  readonly totalDecisions: number;
  readonly recommendation: 'hold' | 'merge';
  readonly agentReplied: boolean;
  readonly failedProof: boolean;
  readonly unexplainedFiles: number;
};

type ProjectReviewNavigation = {
  readonly reviewId: string;
  readonly projectId: string;
  readonly branch: string;
  readonly pullRequest?: string;
  readonly state: 'open' | 'closed';
  readonly archived?: boolean;
  readonly latestRevision: number;
  readonly lastSeenRevision: number;
  readonly latest: LatestReviewNavigation;
};

interface ReviewNavigationReader {
  readonly list: (input: {
    readonly projectId: string;
  }) => Promise<readonly ProjectReviewNavigation[]>;
}

function readProjectReviewNavigation(input: {
  readonly projectId: string;
}): Promise<readonly ProjectReviewNavigation[]> {
  throw new Error('not implemented');
}

const summaries = await readProjectReviewNavigation({ projectId: 'project-a' });
```

Production declarations use canonical native Effect Schema in packages/reviews models and packages/contracts/reviews, with inferred types; the Promise signatures above illustrate consumption only. The domain service keeps the existing named Context.Service/execute/static Layer pattern, not this sketch interface as a new application service convention.

Ownership:

1. packages/storage: read a narrow, consistent projection from reviews joined to its latest review_revisions row, reviewed_layers and comment reply/seen state. Select title from the saved asked text, publication identity/time, small verdict/proof counts and progress. Match marks by decision ID and fingerprint. Do not SELECT full files, summary HTML, diagrams, proof output or diffs; do not loop through readReview or readMarks per record. Existing JSON columns may be inspected in SQLite; bound the query result, and measure the query work before considering any persisted cache. No migration or second writer is proposed.
2. packages/reviews: own the summary model, storage port and list service, and canonical review-completion semantics. Publication/marks/reply/seen/close/archive/link changes invalidate the existing project-review read. Replace the current inventory-badge path's full review/mark reads with the same narrow summary owner; otherwise HTTP fanout would merely move behind the inventory response.
3. apps/server: adapt ListProjectReviewsUseCase and its existing route to the expanded contract. Use its established scoped lane. Summary reads call storage, not Git or GitHub. Inventory continues to use the existing catalog of last-seen checkouts, not per-row Git status reads.
4. packages/client: replace readReviewList's all-document subscriptions with inventory + per-project summaries, and derive status, labels, groups and cross-view search once. Read details/marks only for selected documents. Reuse the existing selection owner and durable-review/project-review invalidation keys.
5. apps/web and apps/mobile: render the same scoped targets and row model. Keep web and native route adapters explicit; active and closed review rows use the same durable review selection semantics.

There is one authoritative stored review and one derived summary. No synchronized navigation table, frontend repository registry, or identity-by-name lookup is introduced.

## Shape 2: one environment navigation endpoint (declined)

```ts
type EnvironmentNavigationSnapshot = {
  readonly environmentId: string;
  readonly inventory: unknown;
  readonly reviews: readonly ProjectReviewNavigation[];
};

function readEnvironmentNavigation(): Promise<EnvironmentNavigationSnapshot> {
  throw new Error('not implemented');
}
```

This would reduce per-project HTTP requests, but combines project inventory and review state behind another application contract and duplicates the existing inventory response. It adds invalidation and ownership decisions before the per-review fanout has been removed. Revisit only if measurements show per-project list latency dominates after the smaller projection exists. No client should coordinate review detail calls to assemble either shape.

## Loading and availability

Checkout identity renders from each environment's available inventory independently. Each environment owns ready/loading/unavailable results; another environment's failure cannot hide healthy rows or clear selection. Show last-known items as unavailable only when already retained by the existing connection owner. Do not add persistence or recovery logic here.

Known durable closed/archived state is immediate. A linked PR whose state has not been read stays Needs you with PR not checked; it never claims Ready to merge from an unknown PR response. Opening the review or an explicit Read pull request again reads that PR. Confirmed closed/merged results move the row to Closed. This accepts delayed GitHub freshness for unopened reviews and removes their startup dependency on GitHub. The title stays the published task; PR title is secondary in selected details rather than replacing row identity as a late network response arrives.

For N saved reviews over P projects and E available environments, navigation performs inventory per environment and one summary read per project: no N review-detail reads, no N mark reads, and no eager N linked-PR reads. Selected-document reads are additional and must be reported separately. This is a request budget, not a latency promise. Database work and inventory badge computation must be measured too.

## Entry points and removals

- Sidebar: Reviews / Worktrees, shared search, project/computer filters, independently collapsed sections, explicit identity Details.
- Keyboard: existing sidebar toggle and workspace search open the same model; preserve document-leave protections and focus return. No new shortcut is required.
- Context/overflow: Details and Copy full path for checkouts; Open workspace only when available; existing PR retry and Archive actions on eligible reviews. Archive uses the existing preview/confirmation and never runs as navigation cleanup.
- Settings: retain project/computer management and exact return target. No connection lifecycle or retry-policy change.
- Remove No review as a mixed queue section, the main-review hiding exception, closed-review checkout suppression, and the Worktrees submenu hidden inside Filter reviews. Keep one directly accessible checkout browser with the existing search entry pointing to it.
- Remove all-review readReview/readReviewMarks/readReviewPullRequest subscriptions from navigation and the duplicated web/native row-selection interpretation.
- Desktop shares the web renderer; Electron connection/folder-menu integration remains a separate verification requirement. Mobile applies the same model to Worktrees/picker, with native chrome and suitable touch targets, iPad landscape first.

## Bounded implementation sequence and acceptance

1. Implement and prove the narrow summary projection/contract, including inventory badges, with actual database fixtures. Prove new tests fail against old behavior; no migration or contract rollout is implicit in this decision.
2. Switch shared client navigation and selected-only loading. Prove two environments with identical repository/branch labels, two checkouts of the same branch, a branch switch at the same path, removed publishing checkout, and partial availability retain the exact scoped identity. Verify zero unselected detail/marks/PR reads with six saved reviews in two fresh browser contexts.
3. Render the two views with stock primitives. At 220 and 248 px and the 414 px drawer, both themes, distinguish same-name targets before navigation; full labels remain available to keyboard and touch. Long project/computer names must not consume the distinguishing folder suffix; allow the stock two-line description and explicit Details rather than adding custom primitive sizing.
4. Align native navigation and durable-review routing, then verify desktop, iPhone, Android and iPad landscape/portrait separately. Do not infer those from web captures. Update feature maps and run only affected tests plus required local checks.

Acceptance also covers no-review projects, main/detached/unavailable checkouts, Needs you/Waiting on agent/Ready to merge, explicit Closed and Archived, PR loading/failure/retry, search and filters intersection, collapse persistence, Settings return, Back/reload, unsaved edits, keyboard focus, touch disclosure, and zero automatic data deletion. A selected item hidden by filters remains visible in the current-target control; unavailable is not silently replaced by a same-name healthy target.

## Risks and decision

One-way door: the proposed public response expansion and review/navigation semantics require owner approval before implementation or landing. The decision artifact itself changes no runtime behavior. The principal tradeoffs are an extra view switch to browse checkouts, taller identity rows when names collide, and deferred PR freshness for unopened reviews. No cross-computer repository grouping, navigation database, migrations, cleanup, or connection recovery changes are approved by this proposal.

Approve the recommended two-view model and Shape 1 together before implementation. No other product choice is required to begin that bounded work.
