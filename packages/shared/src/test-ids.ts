/**
 * Stable `data-testid` values for e2e (and any automation).
 *
 * Contract: Playwright e2e locators prefer these IDs over
 * getByText / ambiguous getByRole. Accessibility roles and aria-labels stay on
 * the product for humans and a11y tooling; tests do not depend on copy that
 * churns with intentional UI work.
 *
 * Naming: kebab-case, surface-first (`rail-tab-changes`).
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
  toggleTerminalPanel: 'toggle-terminal-panel',
  actionsMenu: 'actions-menu',
  commandsMenu: 'commands-menu',
  environmentSwitcher: 'environment-switcher',
  /** Titlebar install chip — only present when an update is downloaded (Electron). */
  updateButton: 'update-button',
  environmentRow: (id: string): string => `environment-row-${id}`,
  /** One address of a saved environment — an environment has many (phase 5). */
  environmentEndpoint: (url: string): string => `environment-endpoint-${url}`,

  // --- Welcome / glance ---
  welcome: 'welcome',
  welcomeOpenRepo: 'welcome-open-repo',
  hubInventory: 'hub-inventory',
  hubEnvironment: (id: string): string => `hub-environment-${id}`,
  hubProject: (id: string): string => `hub-project-${id}`,
  hubWorktree: (id: string): string => `hub-worktree-${id}`,
  hubAddProject: 'hub-add-project',
  hubCreateWorktree: (projectId: string): string => `hub-create-worktree-${projectId}`,
  hubRemoveWorktree: (worktreeId: string): string => `hub-remove-worktree-${worktreeId}`,
  hubRemoveWorktreeDialog: 'hub-remove-worktree-dialog',
  hubRemoveWorktreeConfirm: 'hub-remove-worktree-confirm',
  hubWorktreeSetup: (projectId: string): string => `hub-worktree-setup-${projectId}`,
  hubCreateWorktreeDialog: 'hub-create-worktree-dialog',
  hubCreateWorktreeBranch: 'hub-create-worktree-branch',
  hubCreateWorktreeBase: 'hub-create-worktree-base',
  hubCreateWorktreeSubmit: 'hub-create-worktree-submit',
  hubWorktreeSetupDialog: 'hub-worktree-setup-dialog',
  hubWorktreeSetupStart: 'hub-worktree-setup-start',
  hubWorktreeSetupDispose: 'hub-worktree-setup-dispose',
  hubWorktreeSetupSave: 'hub-worktree-setup-save',
  hubHome: 'hub-home',
  hubProjectSummary: 'hub-project-summary',
  hubWorktreeSummary: 'hub-worktree-summary',
  hubTabTarget: (worktreeId: string): string => `hub-tab-target-${worktreeId}`,
  glance: 'glance',
  glanceChangedFiles: 'glance-changed-files',
  glanceJumpChanges: 'glance-jump-changes',
  glanceJumpTerminal: 'glance-jump-terminal',

  // --- Settings ---
  settingsDialog: 'settings-dialog',
  settingsHeading: 'settings-heading',
  settingsSection: (section: string): string => `settings-section-${section}`,
  browserEnvironmentConnections: 'browser-environment-connections',
  browserEnvironmentLabel: 'browser-environment-label',
  browserEnvironmentUrl: 'browser-environment-url',
  browserEnvironmentToken: 'browser-environment-token',
  browserEnvironmentAdd: 'browser-environment-add',
  browserEnvironmentConnection: (id: string): string => `browser-environment-${id}`,
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
  reviewList: 'review-list',
  reviewOpen: 'review-open',
  reviewOutlineEvidence: 'review-outline-evidence',
  reviewCanvas: 'review-canvas',
  /** Empty Review Canvas — no daemon-root template has been published. */
  reviewCanvasEmpty: 'review-canvas-empty',
  reviewCanvasTab: (tab: 'intent' | 'process' | 'execution' | 'evidence'): string =>
    `review-canvas-tab-${tab}`,
  evidencePanel: 'evidence-panel',
  evidenceClear: 'evidence-clear',
  evidenceIframe: 'evidence-iframe',
  /** Evidence is one pack over three sub-tabs: Checks · Results · Assets (media). */
  evidenceSubTab: (id: 'checks' | 'results' | 'assets'): string => `evidence-sub-tab-${id}`,
  evidenceChecksPane: 'evidence-checks-pane',
  evidenceResultsPane: 'evidence-results-pane',
  evidenceGallery: 'evidence-gallery',
  /** One gallery tile, keyed by its file name inside `evidence/assets/`. */
  evidenceGalleryItem: (file: string): string => `evidence-gallery-item-${file}`,
  evidenceGalleryZoom: 'evidence-gallery-zoom',

  // --- Commit companion ---
  commitButton: 'commit-button',
  commitGroup: 'commit-group',
  generateCommitMessage: 'generate-commit-message',
  generateCommitGroups: 'generate-commit-groups',

  // --- Development servers (daemon-owned, per Worktree) ---
  devServers: 'dev-servers',
  devServersEmpty: 'dev-servers-empty',
  devServerRow: (id: string): string => `dev-server-${id}`,
  devServerUrl: (id: string): string => `dev-server-url-${id}`,
  devServerAttach: (id: string): string => `dev-server-attach-${id}`,
  devServerStop: (id: string): string => `dev-server-stop-${id}`,
  devServerDismiss: (id: string): string => `dev-server-dismiss-${id}`,
  devServerNew: 'dev-server-new',
  devServerLabelInput: 'dev-server-label-input',
  devServerCommandInput: 'dev-server-command-input',
  devServerSubmit: 'dev-server-submit',

  // --- Terminal ---
  terminalNew: 'terminal-new',
  terminalList: 'terminal-list',
  terminalPanel: 'terminal-panel',
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
  /** Shown instead of the list when no Project is selected — nothing to aim at. */
  actionsNoProject: 'actions-no-project',
  /** One Environment heading inside the menu when the Project exists on several. */
  actionsEnvironment: (environmentId: string): string => `actions-environment-${environmentId}`,
  /** Worktree chooser raised when a run has no explicit Worktree target yet. */
  actionsTargetPicker: 'actions-target-picker',
  actionsTargetOption: (worktreeId: string): string => `actions-target-option-${worktreeId}`,

  // --- File comments ---
  fileComments: (path: string): string => `file-comments-${path}`,

  // --- Viewer tabs ---
  viewerTab: (title: string): string =>
    `viewer-tab-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  viewerTabOpenToSide: 'viewer-tab-open-to-side',

  // --- Files tree / prompt ---
  treeEntry: (name: string): string => `tree-entry-${name}`,
  filePromptName: 'file-prompt-name',
  fileEditor: 'file-editor',

  // --- Tasks (the daemon-wide table) ---
  tasksOpen: 'tasks-open',
  tasksView: 'tasks-view',
  tasksTable: 'tasks-table',
  tasksEmpty: 'tasks-empty',
  tasksError: 'tasks-error',
  tasksRow: (id: string): string => `tasks-row-${id}`,
  /** The compact sidebar list entry — distinct from the Viewer table row above. */
  tasksListRow: (id: string): string => `tasks-list-row-${id}`,
  tasksRowStatus: (id: string): string => `tasks-row-status-${id}`,
  tasksRowDelete: (id: string): string => `tasks-row-delete-${id}`,
  tasksColumnsMenu: 'tasks-columns-menu',
  tasksColumnToggle: (column: string): string => `tasks-column-toggle-${column}`,
  tasksQuickAdd: 'tasks-quick-add',
  tasksQuickAddTitle: 'tasks-quick-add-title',
  tasksQuickAddStatus: 'tasks-quick-add-status',
  tasksQuickAddTags: 'tasks-quick-add-tags',
  tasksQuickAddEnvironment: 'tasks-quick-add-environment',
  tasksQuickAddLinkUrl: 'tasks-quick-add-link-url',
  tasksQuickAddLinkLabel: 'tasks-quick-add-link-label',
  tasksQuickAddAttachment: 'tasks-quick-add-attachment',
  tasksQuickAddSubmit: 'tasks-quick-add-submit',

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

  // --- Canvas (daemon-root Project store, ADR 0002) ---
  canvasList: 'canvas-list',
  canvasListEmpty: 'canvas-list-empty',
  canvasListItem: (id: string): string => `canvas-list-item-${id}`,
  /** Badge on a Canvas promoted into the checkout's tracked `.porcelain/` overlay (#26). */
  canvasListTracked: (id: string): string => `canvas-list-tracked-${id}`,
  /** Per-row actions trigger; only private (untracked) Canvases have one. */
  canvasListMenu: (id: string): string => `canvas-list-menu-${id}`,
  /** "Promote to Git…" menu item — opens the explicit-target confirmation. */
  canvasListPromote: (id: string): string => `canvas-list-promote-${id}`,
  /** The confirm control that actually promotes, naming the target checkout. */
  canvasPromoteConfirm: 'canvas-promote-confirm',
  /** Sidebar entry that tracks the Project's hidden/pinned defaults into the checkout. */
  /** Sandboxed HTML Canvas iframe — sandbox="allow-scripts", no allow-same-origin. */
  canvasIframe: 'canvas-iframe',

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
