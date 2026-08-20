import type { Locator, Page } from '@playwright/test'
import { TestIds } from './test-ids'

/** Playwright root for a stable `data-testid`. Prefer this over getByText/getByRole in e2e. */
export function byId(page: Page | Locator, id: string): Locator {
  return page.getByTestId(id)
}

export const loc = {
  rail: (page: Page): Locator => byId(page, TestIds.rail),
  railTab: (page: Page, tab: string): Locator => byId(page, TestIds.railTab(tab)),
  // Every rail tab at once, for asserting the rail's shape. Prefix match — a count
  // has no single id to ask for, unlike `railTab`.
  railTabs: (page: Page): Locator => page.locator(`[data-testid^="${TestIds.railTab('')}"]`),
  railSettings: (page: Page): Locator => byId(page, TestIds.railSettings),
  sidebarPanel: (page: Page): Locator => byId(page, TestIds.sidebarPanel),
  rightSidebar: (page: Page): Locator => byId(page, TestIds.rightSidebar),
  viewerCard: (page: Page): Locator => byId(page, TestIds.viewerCard),
  viewerEmpty: (page: Page): Locator => byId(page, TestIds.viewerEmpty),
  tasksNew: (page: Page): Locator => byId(page, TestIds.tasksNew),
  toggleLeftSidebar: (page: Page): Locator => byId(page, TestIds.toggleLeftSidebar),
  toggleRightSidebar: (page: Page): Locator => byId(page, TestIds.toggleRightSidebar),
  commandsMenu: (page: Page): Locator => byId(page, TestIds.commandsMenu),

  welcome: (page: Page): Locator => byId(page, TestIds.welcome),
  welcomeOpenRepo: (page: Page): Locator => byId(page, TestIds.welcomeOpenRepo),
  hubInventory: (page: Page): Locator => byId(page, TestIds.hubInventory),
  hubEnvironment: (page: Page, id: string): Locator => byId(page, TestIds.hubEnvironment(id)),
  hubProject: (page: Page, id: string): Locator => byId(page, TestIds.hubProject(id)),
  hubWorktree: (page: Page, id: string): Locator => byId(page, TestIds.hubWorktree(id)),
  hubCreateWorktree: (page: Page, projectId: string): Locator =>
    byId(page, TestIds.hubCreateWorktree(projectId)),
  hubCreateWorktreeBranch: (page: Page): Locator => byId(page, TestIds.hubCreateWorktreeBranch),
  hubCreateWorktreeSubmit: (page: Page): Locator => byId(page, TestIds.hubCreateWorktreeSubmit),
  hubWorktrees: (page: Page): Locator =>
    page.locator('[data-testid^="hub-worktree-"]:not([data-testid="hub-worktree-summary"])'),
  hubProjects: (page: Page): Locator => page.locator('[data-testid^="hub-project-"]'),
  hubHome: (page: Page): Locator => byId(page, TestIds.hubHome),
  hubProjectSummary: (page: Page): Locator => byId(page, TestIds.hubProjectSummary),
  hubWorktreeSummary: (page: Page): Locator => byId(page, TestIds.hubWorktreeSummary),
  hubTabTargets: (page: Page, worktreeId: string): Locator =>
    page.locator(`[data-hub-worktree="${worktreeId}"]`),
  hubTabTarget: (
    page: Page,
    target: { environmentId: string; projectId: string; worktreeId: string },
  ): Locator =>
    page.locator(
      `[data-hub-environment="${target.environmentId}"][data-hub-project="${target.projectId}"][data-hub-worktree="${target.worktreeId}"]`,
    ),
  glance: (page: Page): Locator => byId(page, TestIds.glance),
  glanceChangedFiles: (page: Page): Locator => byId(page, TestIds.glanceChangedFiles),

  tasksOpen: (page: Page): Locator => byId(page, TestIds.tasksOpen),
  tasksView: (page: Page): Locator => byId(page, TestIds.tasksView),
  tasksTable: (page: Page): Locator => byId(page, TestIds.tasksTable),
  tasksEmpty: (page: Page): Locator => byId(page, TestIds.tasksEmpty),
  tasksRow: (page: Page, id: string): Locator => byId(page, TestIds.tasksRow(id)),
  // Every row at once — a count has no single id to ask for, like `railTabs`.
  tasksRows: (page: Page): Locator => page.locator(`[data-testid^="${TestIds.tasksRow('')}"]`),
  tasksListRow: (page: Page, id: string): Locator => byId(page, TestIds.tasksListRow(id)),
  tasksRowStatus: (page: Page, id: string): Locator => byId(page, TestIds.tasksRowStatus(id)),
  tasksRowDelete: (page: Page, id: string): Locator => byId(page, TestIds.tasksRowDelete(id)),
  tasksColumnsMenu: (page: Page): Locator => byId(page, TestIds.tasksColumnsMenu),
  tasksColumnToggle: (page: Page, column: string): Locator =>
    byId(page, TestIds.tasksColumnToggle(column)),
  tasksComposer: (page: Page): Locator => byId(page, TestIds.tasksComposer),
  tasksComposerTitle: (page: Page): Locator => byId(page, TestIds.tasksComposerTitle),
  tasksComposerProject: (page: Page): Locator => byId(page, TestIds.tasksComposerProject),
  tasksComposerAttach: (page: Page): Locator => byId(page, TestIds.tasksComposerAttach),
  tasksComposerSubmit: (page: Page): Locator => byId(page, TestIds.tasksComposerSubmit),
  tasksDialog: (page: Page): Locator => byId(page, TestIds.tasksDialog),
  tasksSheet: (page: Page): Locator => byId(page, TestIds.tasksSheet),
  tasksFilter: (page: Page): Locator => byId(page, TestIds.tasksFilter),

  canvasList: (page: Page): Locator => byId(page, TestIds.canvasList),
  canvasListItems: (page: Page): Locator => page.locator('[data-testid^="canvas-list-item-"]'),
  canvasListEmpty: (page: Page): Locator => byId(page, TestIds.canvasListEmpty),
  canvasListItem: (page: Page, id: string): Locator => byId(page, TestIds.canvasListItem(id)),
  canvasIframe: (page: Page): Locator => byId(page, TestIds.canvasIframe),
  canvasListTracked: (page: Page, id: string): Locator => byId(page, TestIds.canvasListTracked(id)),
  hubRemoveWorktreeDialog: (page: Page): Locator => byId(page, TestIds.hubRemoveWorktreeDialog),
  hubRemoveWorktreeConfirm: (page: Page): Locator => byId(page, TestIds.hubRemoveWorktreeConfirm),
  canvasListMenu: (page: Page, id: string): Locator => byId(page, TestIds.canvasListMenu(id)),
  canvasListPromote: (page: Page, id: string): Locator => byId(page, TestIds.canvasListPromote(id)),
  canvasPromoteConfirm: (page: Page): Locator => byId(page, TestIds.canvasPromoteConfirm),

  settingsDialog: (page: Page): Locator => byId(page, TestIds.settingsDialog),
  settingsHeading: (page: Page): Locator => byId(page, TestIds.settingsHeading),
  settingsSection: (page: Page, section: string): Locator =>
    byId(page, TestIds.settingsSection(section)),
  browserEnvironmentConnections: (page: Page): Locator =>
    byId(page, TestIds.browserEnvironmentConnections),
  browserEnvironmentLabel: (page: Page): Locator => byId(page, TestIds.browserEnvironmentLabel),
  browserEnvironmentUrl: (page: Page): Locator => byId(page, TestIds.browserEnvironmentUrl),
  browserEnvironmentToken: (page: Page): Locator => byId(page, TestIds.browserEnvironmentToken),
  browserEnvironmentAdd: (page: Page): Locator => byId(page, TestIds.browserEnvironmentAdd),
  shareStatus: (page: Page): Locator => byId(page, TestIds.shareStatus),
  appearance: (page: Page, mode: 'light' | 'dark' | 'system'): Locator =>
    byId(
      page,
      mode === 'light'
        ? TestIds.settingsAppearanceLight
        : mode === 'dark'
          ? TestIds.settingsAppearanceDark
          : TestIds.settingsAppearanceSystem,
    ),

  changesList: (page: Page): Locator => byId(page, TestIds.changesList),
  changesSummary: (page: Page): Locator => byId(page, TestIds.changesSummary),
  commentsManage: (page: Page): Locator => byId(page, TestIds.commentsManage),
  commentsResolveAll: (page: Page): Locator => byId(page, TestIds.commentsResolveAll),
  commentsClearResolved: (page: Page): Locator => byId(page, TestIds.commentsClearResolved),
  commentsDeleteAll: (page: Page): Locator => byId(page, TestIds.commentsDeleteAll),
  changesFile: (page: Page, fileName: string): Locator => byId(page, TestIds.changesFile(fileName)),
  diffCollapse: (page: Page, path: string): Locator => byId(page, TestIds.diffCollapse(path)),
  diffReviewed: (page: Page, path: string): Locator => byId(page, TestIds.diffReviewed(path)),

  worktreeSwitcher: (page: Page): Locator => byId(page, TestIds.worktreeSwitcher),
  worktreeMenuItem: (page: Page, branch: string): Locator =>
    byId(page, TestIds.worktreeMenuItem(branch)),
  branchSwitcher: (page: Page): Locator => byId(page, TestIds.branchSwitcher),

  reviewList: (page: Page): Locator => byId(page, TestIds.reviewList),
  reviewOpen: (page: Page): Locator => byId(page, TestIds.reviewOpen),
  reviewCanvas: (page: Page): Locator => byId(page, TestIds.reviewCanvas),
  reviewCanvasEmpty: (page: Page): Locator => byId(page, TestIds.reviewCanvasEmpty),
  reviewCanvasTab: (page: Page, tab: 'intent' | 'process' | 'execution' | 'evidence'): Locator =>
    byId(page, TestIds.reviewCanvasTab(tab)),
  evidencePanel: (page: Page): Locator => byId(page, TestIds.evidencePanel),
  evidenceClear: (page: Page): Locator => byId(page, TestIds.evidenceClear),
  evidenceIframe: (page: Page): Locator => byId(page, TestIds.evidenceIframe),
  evidenceSubTab: (page: Page, tab: 'checks' | 'results' | 'assets'): Locator =>
    byId(page, TestIds.evidenceSubTab(tab)),
  evidenceChecksPane: (page: Page): Locator => byId(page, TestIds.evidenceChecksPane),
  evidenceResultsPane: (page: Page): Locator => byId(page, TestIds.evidenceResultsPane),
  evidenceDocTab: (page: Page, label: string): Locator => byId(page, TestIds.intentDocTab(label)),
  evidenceGallery: (page: Page): Locator => byId(page, TestIds.evidenceGallery),
  evidenceGalleryItem: (page: Page, file: string): Locator =>
    byId(page, TestIds.evidenceGalleryItem(file)),
  evidenceGalleryZoom: (page: Page): Locator => byId(page, TestIds.evidenceGalleryZoom),

  commitButton: (page: Page): Locator => byId(page, TestIds.commitButton),
  commitGroup: (page: Page): Locator => byId(page, TestIds.commitGroup),

  // --- The Terminals surface: the one terminal home ---
  terminalsOpen: (page: Page): Locator => byId(page, TestIds.terminalsOpen),
  terminalsBoard: (page: Page): Locator => byId(page, TestIds.terminalsBoard),
  terminalsBoardNew: (page: Page): Locator => byId(page, TestIds.terminalsBoardNew),
  /** "New terminal" targets that are a checkout, not the Environment's own home. */
  terminalsBoardNewInProject: (page: Page): Locator =>
    page.locator(
      `[data-testid^="${TestIds.terminalsBoardNewAt('')}"]:not([data-testid="${TestIds.terminalsBoardNewAt('environment')}"])`,
    ),
  /** Every session row on the board — a count has no single id to ask for. */
  terminalsBoardSessions: (page: Page): Locator =>
    page.locator(`[data-testid^="${TestIds.terminalsBoardSession('')}"]`),
  terminalsBoardEnvironmentShell: (page: Page, key: string): Locator =>
    byId(page, TestIds.terminalsBoardEnvironmentShell(key)),
  terminalSession: (page: Page, name: string): Locator =>
    byId(page, TestIds.terminalsBoard)
      .locator('button')
      .filter({ hasText: new RegExp(`^${name}$`) }),
  terminalKeyBar: (page: Page): Locator => byId(page, TestIds.terminalKeyBar),
  terminalKey: (page: Page, label: string): Locator => byId(page, TestIds.terminalKey(label)),
  terminalContextMenu: (page: Page): Locator => byId(page, TestIds.terminalContextMenu),
  terminalContextCopy: (page: Page): Locator => byId(page, TestIds.terminalContextCopy),
  terminalContextPaste: (page: Page): Locator => byId(page, TestIds.terminalContextPaste),
  terminalContextAttachFile: (page: Page): Locator => byId(page, TestIds.terminalContextAttachFile),
  terminalContextSelectAll: (page: Page): Locator => byId(page, TestIds.terminalContextSelectAll),
  terminalContextClear: (page: Page): Locator => byId(page, TestIds.terminalContextClear),
  actionsMenu: (page: Page): Locator => byId(page, TestIds.actionsMenu),
  actionsAdd: (page: Page): Locator => byId(page, TestIds.actionsAdd),
  actionRun: (page: Page, title: string): Locator => byId(page, TestIds.actionRun(title)),
  actionTitleInput: (page: Page): Locator => byId(page, TestIds.actionTitleInput),
  actionCommandInput: (page: Page): Locator => byId(page, TestIds.actionCommandInput),
  actionSave: (page: Page): Locator => byId(page, TestIds.actionSave),
  actionsNoProject: (page: Page): Locator => byId(page, TestIds.actionsNoProject),
  actionUnreviewed: (page: Page, title: string): Locator =>
    byId(page, TestIds.actionUnreviewed(title)),
  actionTrustDialog: (page: Page): Locator => byId(page, TestIds.actionTrustDialog),
  actionTrustConfirm: (page: Page): Locator => byId(page, TestIds.actionTrustConfirm),
  actionsTargetPicker: (page: Page): Locator => byId(page, TestIds.actionsTargetPicker),

  viewerTab: (page: Page, title: string): Locator => byId(page, TestIds.viewerTab(title)),
  viewerTabs: (page: Page): Locator => page.locator('[data-testid^="viewer-tab-"]'),
  viewerTabOpenToSide: (page: Page): Locator => byId(page, TestIds.viewerTabOpenToSide),

  treeEntry: (page: Page, name: string): Locator => byId(page, TestIds.treeEntry(name)),
  filePromptName: (page: Page): Locator => byId(page, TestIds.filePromptName),
  fileEditor: (page: Page): Locator => byId(page, TestIds.fileEditor),
}
