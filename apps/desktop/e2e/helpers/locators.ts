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
  toggleLeftSidebar: (page: Page): Locator => byId(page, TestIds.toggleLeftSidebar),
  toggleRightSidebar: (page: Page): Locator => byId(page, TestIds.toggleRightSidebar),
  actionsMenu: (page: Page): Locator => byId(page, TestIds.actionsMenu),
  commandsMenu: (page: Page): Locator => byId(page, TestIds.commandsMenu),
  environmentSwitcher: (page: Page): Locator => byId(page, TestIds.environmentSwitcher),

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
  devServers: (page: Page): Locator => byId(page, TestIds.devServers),
  devServersEmpty: (page: Page): Locator => byId(page, TestIds.devServersEmpty),
  devServerRows: (page: Page): Locator => page.locator('[data-testid^="dev-server-"][data-status]'),
  devServerRow: (page: Page, id: string): Locator => byId(page, TestIds.devServerRow(id)),
  devServerUrl: (page: Page, id: string): Locator => byId(page, TestIds.devServerUrl(id)),
  devServerStop: (page: Page, id: string): Locator => byId(page, TestIds.devServerStop(id)),
  devServerDismiss: (page: Page, id: string): Locator => byId(page, TestIds.devServerDismiss(id)),
  devServerLabelInput: (page: Page): Locator => byId(page, TestIds.devServerLabelInput),
  devServerCommandInput: (page: Page): Locator => byId(page, TestIds.devServerCommandInput),
  devServerSubmit: (page: Page): Locator => byId(page, TestIds.devServerSubmit),
  glance: (page: Page): Locator => byId(page, TestIds.glance),
  glanceChangedFiles: (page: Page): Locator => byId(page, TestIds.glanceChangedFiles),
  glanceJumpTerminal: (page: Page): Locator => byId(page, TestIds.glanceJumpTerminal),

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
  tasksQuickAdd: (page: Page): Locator => byId(page, TestIds.tasksQuickAdd),
  tasksQuickAddTitle: (page: Page): Locator => byId(page, TestIds.tasksQuickAddTitle),
  tasksQuickAddStatus: (page: Page): Locator => byId(page, TestIds.tasksQuickAddStatus),
  tasksQuickAddTags: (page: Page): Locator => byId(page, TestIds.tasksQuickAddTags),
  tasksQuickAddEnvironment: (page: Page): Locator => byId(page, TestIds.tasksQuickAddEnvironment),
  tasksQuickAddLinkUrl: (page: Page): Locator => byId(page, TestIds.tasksQuickAddLinkUrl),
  tasksQuickAddLinkLabel: (page: Page): Locator => byId(page, TestIds.tasksQuickAddLinkLabel),
  tasksQuickAddAttachment: (page: Page): Locator => byId(page, TestIds.tasksQuickAddAttachment),
  tasksQuickAddSubmit: (page: Page): Locator => byId(page, TestIds.tasksQuickAddSubmit),

  canvasList: (page: Page): Locator => byId(page, TestIds.canvasList),
  canvasListItems: (page: Page): Locator => page.locator('[data-testid^="canvas-list-item-"]'),
  canvasListEmpty: (page: Page): Locator => byId(page, TestIds.canvasListEmpty),
  canvasListItem: (page: Page, id: string): Locator => byId(page, TestIds.canvasListItem(id)),
  canvasIframe: (page: Page): Locator => byId(page, TestIds.canvasIframe),
  canvasListTracked: (page: Page, id: string): Locator => byId(page, TestIds.canvasListTracked(id)),
  canvasListMenu: (page: Page, id: string): Locator => byId(page, TestIds.canvasListMenu(id)),
  canvasListPromote: (page: Page, id: string): Locator => byId(page, TestIds.canvasListPromote(id)),
  canvasPromoteConfirm: (page: Page): Locator => byId(page, TestIds.canvasPromoteConfirm),
  canvasTrackDefaults: (page: Page): Locator => byId(page, TestIds.canvasTrackDefaults),
  canvasTrackDefaultsConfirm: (page: Page): Locator =>
    byId(page, TestIds.canvasTrackDefaultsConfirm),

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

  terminalNew: (page: Page): Locator => byId(page, TestIds.terminalNew),
  terminalSession: (page: Page, name: string): Locator =>
    byId(page, TestIds.terminalPanel)
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
