/**
 * Stable `data-testid` values for e2e (and any automation).
 *
 * Contract: Playwright e2e locators prefer these IDs over
 * getByText / ambiguous getByRole. Accessibility roles and aria-labels stay on
 * the product for humans and a11y tooling; tests do not depend on copy that
 * churns with intentional UI work.
 *
 * Naming: kebab-case, surface-first (`feature-canvas`, `rail-tab-changes`).
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
  viewerCard: 'viewer-card',
  toggleLeftSidebar: 'toggle-left-sidebar',
  toggleRightSidebar: 'toggle-right-sidebar',
  environmentSwitcher: 'environment-switcher',
  /** Titlebar install chip — only present when an update is downloaded (Electron). */
  updateButton: 'update-button',
  environmentRow: (id: string): string => `environment-row-${id}`,
  /** One address of a saved environment — an environment has many (phase 5). */
  environmentEndpoint: (url: string): string => `environment-endpoint-${url}`,

  // --- Welcome / glance ---
  welcome: 'welcome',
  welcomeOpenRepo: 'welcome-open-repo',
  glance: 'glance',
  glanceChangedFiles: 'glance-changed-files',
  glanceJumpChanges: 'glance-jump-changes',
  glanceJumpReview: 'glance-jump-review',
  glanceJumpBoard: 'glance-jump-board',
  glanceJumpTerminal: 'glance-jump-terminal',

  // --- Settings ---
  settingsDialog: 'settings-dialog',
  settingsHeading: 'settings-heading',
  settingsAppearanceLight: 'settings-appearance-light',
  settingsAppearanceDark: 'settings-appearance-dark',
  settingsAppearanceSystem: 'settings-appearance-system',
  /** Settings → Share: authorized and pending devices. */
  shareStatus: 'share-status',
  /** Settings → Review layers: copy agent setup prompt (shown while starters only). */
  layersCopySetup: 'layers-copy-setup',
  /** Settings → Review layers: starter/unconfigured explainer. */
  layersStarterBanner: 'layers-starter-banner',
  layersStarterDismiss: 'layers-starter-dismiss',

  // --- Changes ---
  changesList: 'changes-list',
  changesSummary: 'changes-summary',
  changesFile: (fileName: string): string => `changes-file-${fileName}`,
  diffCollapse: (path: string): string => `diff-collapse-${path}`,
  diffReviewed: (path: string): string => `diff-reviewed-${path}`,
  /** Quiet kickoff when layers are still starters (not agent-configured). */
  changesLayersSetup: 'changes-layers-setup',
  changesLayersSetupDismiss: 'changes-layers-setup-dismiss',

  // --- Files ---
  /** Quiet kickoff when monorepo scope is empty and the root looks noisy. */
  filesScopeSetup: 'files-scope-setup',
  filesScopeSetupDismiss: 'files-scope-setup-dismiss',

  // --- Worktree / branch footer ---
  worktreeSwitcher: 'worktree-switcher',
  worktreeMenuItem: (branch: string): string => `worktree-item-${branch}`,
  branchSwitcher: 'branch-switcher',

  // --- Review / Feature ---
  reviewInbox: 'review-inbox',
  reviewInboxRow: (branch: string): string => `review-inbox-row-${branch}`,
  featureList: 'feature-list',
  featureOpenReview: 'feature-open-review',
  /** Right-rail companion: clear the published Review + evidence (confirm first). */
  featureClearReview: 'feature-clear-review',
  /** Ship handoff: open Changes (commit home) after review progress. */
  featureCommitChanges: 'feature-commit-changes',
  featureOutlineEvidence: 'feature-outline-evidence',
  featureCanvas: 'feature-canvas',
  /** Empty Review canvas — start-of-unit affordance. */
  featureEmpty: 'feature-empty',
  /** Lifecycle banner on the canvas (in progress / ready to close). */
  featureLifecycle: 'feature-lifecycle',
  featureCanvasTab: (tab: 'intent' | 'execution' | 'evidence'): string =>
    `feature-canvas-tab-${tab}`,
  evidencePanel: 'evidence-panel',
  evidenceClear: 'evidence-clear',
  evidenceIframe: 'evidence-iframe',
  /** Board Focus → open Review with title prefilled for the start prompt. */
  boardStartReview: 'board-start-review',

  // --- Commit companion ---
  commitButton: 'commit-button',
  commitGroup: 'commit-group',

  // --- Terminal ---
  terminalNew: 'terminal-new',
  terminalList: 'terminal-list',
  /** The key bar above a terminal pane on touch (Esc/Tab/Ctrl/arrows a soft keyboard lacks). */
  terminalKeyBar: 'terminal-key-bar',
  terminalKey: (label: string): string =>
    `terminal-key-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  /** Floating Copy chip over a non-empty terminal selection. */
  terminalSelectionToolbar: 'terminal-selection-toolbar',
  terminalSelectionCopy: 'terminal-selection-copy',
  /** Machine picker items shown when the window is bound to a REMOTE daemon. */
  terminalNewRemote: 'terminal-new-remote',
  terminalNewLocal: 'terminal-new-local',
  localTerminalPathInput: 'local-terminal-path-input',
  localTerminalPathSave: 'local-terminal-path-save',
  /**
   * Header icon left of "+" on a remote-bound Terminal tab — set/change the local
   * clone path used by "This device" shells and local-targeted actions.
   */
  localTerminalPathButton: 'local-terminal-path-button',
  actionsAdd: 'actions-add',
  actionRun: (title: string): string =>
    `action-run-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  actionTitleInput: 'action-title-input',
  actionCommandInput: 'action-command-input',
  actionWhere: 'action-where',
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
