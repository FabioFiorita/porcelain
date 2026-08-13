/**
 * Stable `data-testid` values for e2e (and any automation).
 *
 * Contract: Playwright e2e locators prefer these IDs over
 * getByText / ambiguous getByRole. Accessibility roles and aria-labels stay on
 * the product for humans and a11y tooling; tests do not depend on copy that
 * churns with intentional UI work.
 *
 * Naming: kebab-case, surface-first (`active-review`, `rail-tab-changes`).
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
  settingsCommitModel: 'settings-commit-model',
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

  // --- Review ---
  reviewInbox: 'review-inbox',
  reviewInboxRow: (branch: string): string => `review-inbox-row-${branch}`,
  reviewList: 'review-list',
  reviewOpen: 'review-open',
  /** Right-rail companion: archive the published Review + evidence (confirm first). */
  reviewArchive: 'review-archive',
  /** Right-rail list of archived previous reviews. */
  previousReviews: 'previous-reviews',
  previousReviewRow: (id: string): string => `previous-review-${id}`,
  previousReviewRestore: (id: string): string => `previous-review-restore-${id}`,
  previousReviewDelete: (id: string): string => `previous-review-delete-${id}`,
  reviewOutlineEvidence: 'review-outline-evidence',
  activeReview: 'active-review',
  /** Empty Review canvas — start-of-unit affordance. */
  activeReviewEmpty: 'active-review-empty',
  activeReviewTab: (tab: 'intent' | 'execution' | 'evidence'): string => `active-review-tab-${tab}`,
  evidencePanel: 'evidence-panel',
  evidenceClear: 'evidence-clear',
  evidenceIframe: 'evidence-iframe',
  /** Evidence is one pack over three sub-tabs: Checks · Results · Assets. */
  evidenceSubTab: (id: 'checks' | 'results' | 'assets'): string => `evidence-sub-tab-${id}`,
  evidenceChecksPane: 'evidence-checks-pane',
  evidenceResultsPane: 'evidence-results-pane',
  evidenceGallery: 'evidence-gallery',
  /** One gallery tile, keyed by its file name inside `evidence/assets/`. */
  evidenceGalleryItem: (file: string): string => `evidence-gallery-item-${file}`,
  evidenceGalleryZoom: 'evidence-gallery-zoom',
  /** Board Focus → open Review with title prefilled for the start prompt. */
  boardStartReview: 'board-start-review',

  // --- Commit companion ---
  commitButton: 'commit-button',
  commitGroup: 'commit-group',
  generateCommitMessage: 'generate-commit-message',
  generateCommitGroups: 'generate-commit-groups',

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
  terminalContextMenu: 'terminal-context-menu',
  terminalContextCopy: 'terminal-context-copy',
  terminalContextPaste: 'terminal-context-paste',
  terminalContextPasteImage: 'terminal-context-paste-image',
  terminalContextAttachFile: 'terminal-context-attach-file',
  terminalContextSelectAll: 'terminal-context-select-all',
  terminalContextClear: 'terminal-context-clear',
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

  // --- Review documents (Intent panes and Evidence Results) ---
  intentDocTabs: 'intent-doc-tabs',
  intentDocTab: (label: string): string =>
    `intent-doc-tab-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  /** One rendered document body — the same renderer serves Intent and Results. */
  reviewDocBody: 'review-doc-body',
  evidenceDocTabs: 'evidence-doc-tabs',
  paneError: 'pane-error',
  reviewPublish: 'review-publish',
  reviewPublishConfirm: 'review-publish-confirm',
  reviewPublishCost: 'review-publish-cost',
  /** Publish dialog warning shown when `.porcelain/` is hidden from git in this clone. */
  reviewPublishVisibilityNote: 'review-publish-visibility-note',

  // --- Saved action trust ---
  actionTrustDialog: 'action-trust-dialog',
  actionTrustCommand: 'action-trust-command',
  actionTrustConfirm: 'action-trust-confirm',
  actionUnreviewed: (title: string): string =>
    `action-unreviewed-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,

  // --- Settings › Data (what git carries) ---
  companionDispositions: 'companion-dispositions',
  companionDisposition: (key: string, disposition: string): string =>
    `companion-disposition-${key}-${disposition}`,
  /** The plain-language line under a row: what git does with this channel today. */
  companionDispositionState: (key: string): string => `companion-disposition-${key}-state`,
  companionUntracked: 'companion-untracked',
  companionGitVisibility: 'companion-git-visibility',
  companionGitVisibilityToggle: 'companion-git-visibility-toggle',
} as const
