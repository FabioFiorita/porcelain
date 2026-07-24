/**
 * Stable `data-testid` values for e2e (and any automation).
 *
 * Contract (decided 2026-07-21): Playwright e2e locators prefer these IDs over
 * getByText / ambiguous getByRole. Accessibility roles and aria-labels stay on
 * the product for humans and a11y tooling; tests do not depend on copy that
 * churns with intentional UI work.
 *
 * Naming: kebab-case, surface-first (`agent-timeline`, `rail-tab-changes`).
 * Dynamic IDs use a function so both product and e2e share one spelling.
 */

export const TestIds = {
  // --- Shell / rail ---
  rail: 'rail',
  railTab: (tab: string): string => `rail-tab-${tab}`,
  railSettings: 'rail-settings',
  sidebarPanel: 'sidebar-panel',
  sidebarPanelTitle: 'sidebar-panel-title',
  rightSidebar: 'right-sidebar',
  toggleLeftSidebar: 'toggle-left-sidebar',
  toggleRightSidebar: 'toggle-right-sidebar',

  // --- Welcome / glance ---
  welcome: 'welcome',
  welcomeOpenRepo: 'welcome-open-repo',
  glance: 'glance',
  glanceChangedFiles: 'glance-changed-files',

  // --- Settings ---
  settingsDialog: 'settings-dialog',
  settingsHeading: 'settings-heading',
  settingsAppearanceLight: 'settings-appearance-light',
  settingsAppearanceDark: 'settings-appearance-dark',
  settingsAppearanceSystem: 'settings-appearance-system',

  // --- Changes ---
  changesList: 'changes-list',
  changesSummary: 'changes-summary',
  changesFile: (fileName: string): string => `changes-file-${fileName}`,

  // --- Worktree / branch footer ---
  worktreeSwitcher: 'worktree-switcher',
  worktreeMenuItem: (branch: string): string => `worktree-item-${branch}`,
  branchSwitcher: 'branch-switcher',

  // --- Review / Feature ---
  reviewInbox: 'review-inbox',
  reviewInboxRow: (branch: string): string => `review-inbox-row-${branch}`,
  featureList: 'feature-list',
  featureOpenReview: 'feature-open-review',
  /** Ship handoff: open Changes (commit home) after review progress. */
  featureCommitChanges: 'feature-commit-changes',
  featureOutlineEvidence: 'feature-outline-evidence',
  /** Agent-list cue that hands off to the Review sidebar (inbox home). */
  agentReviewInboxCue: 'agent-review-inbox-cue',
  featureCanvas: 'feature-canvas',
  featureCanvasTab: (tab: 'intent' | 'execution' | 'evidence'): string =>
    `feature-canvas-tab-${tab}`,
  evidencePanel: 'evidence-panel',
  evidenceClear: 'evidence-clear',
  evidenceIframe: 'evidence-iframe',

  // --- Commit companion ---
  commitButton: 'commit-button',
  commitGroup: 'commit-group',

  // --- Agent ---
  agentList: 'agent-list',
  agentNewThread: 'agent-new-thread',
  agentProviderMenu: 'agent-provider-menu',
  agentWorktreeMenuItem: 'agent-worktree-menu-item',
  agentWorktreeBranch: 'agent-worktree-branch',
  agentWorktreeCreate: 'agent-worktree-create',
  agentThreadRow: (id: string): string => `agent-thread-row-${id}`,
  /** Roster segment filter (`active` | `recent` | `archived`). */
  agentThreadFilter: (filter: string): string => `agent-thread-filter-${filter}`,
  agentComposer: 'agent-composer',
  agentSend: 'agent-send',
  agentModeChip: 'agent-mode-chip',
  /** Permission-mode radio row (`approve` | `auto-edits` | `full`). */
  agentModeOption: (mode: string): string => `agent-mode-${mode}`,
  agentInteractionChip: 'agent-interaction-chip',
  agentInteractionOption: (interaction: string): string => `agent-interaction-${interaction}`,
  agentTimeline: 'agent-timeline',
  agentPlan: 'agent-plan',
  agentPlanProgress: 'agent-plan-progress',
  agentTool: (title: string): string =>
    `agent-tool-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  agentApproval: 'agent-approval',
  agentApprovalAccept: 'agent-approval-accept',
  agentApprovalStatus: 'agent-approval-status',
  agentSessionStrip: 'agent-session-strip',
  agentSessionStatus: 'agent-session-status',
  agentSessionCompanion: 'agent-session-companion',
  agentSessionCompanionStatus: 'agent-session-companion-status',
  agentUsageLastTurn: 'agent-usage-last-turn',
  agentUserBubble: 'agent-user-bubble',
  agentAssistantMessage: 'agent-assistant-message',

  // --- Terminal ---
  terminalNew: 'terminal-new',
  terminalList: 'terminal-list',
  actionsAdd: 'actions-add',
  actionRun: (title: string): string =>
    `action-run-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  actionTitleInput: 'action-title-input',
  actionCommandInput: 'action-command-input',
  actionSave: 'action-save',

  // --- Viewer tabs ---
  viewerTab: (title: string): string =>
    `viewer-tab-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  viewerTabOpenToSide: 'viewer-tab-open-to-side',

  // --- Files tree / prompt ---
  treeEntry: (name: string): string => `tree-entry-${name}`,
  filePromptName: 'file-prompt-name',
  fileEditor: 'file-editor',

  // --- Board ---
  boardCard: (title: string): string =>
    `board-card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  /** Right-rail Focus companion (selected / default Doing card detail). */
  boardFocus: 'board-focus',
  cardTitleInput: 'card-title-input',
  cardComposerSave: 'card-composer-save',
  cardComposer: 'card-composer',
} as const
