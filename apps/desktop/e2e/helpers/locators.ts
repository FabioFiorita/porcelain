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

  welcome: (page: Page): Locator => byId(page, TestIds.welcome),
  welcomeOpenRepo: (page: Page): Locator => byId(page, TestIds.welcomeOpenRepo),
  hubInventory: (page: Page): Locator => byId(page, TestIds.hubInventory),
  hubEnvironment: (page: Page, id: string): Locator => byId(page, TestIds.hubEnvironment(id)),
  hubProject: (page: Page, id: string): Locator => byId(page, TestIds.hubProject(id)),
  hubWorktree: (page: Page, id: string): Locator => byId(page, TestIds.hubWorktree(id)),
  hubCreateWorktree: (page: Page, projectId: string): Locator =>
    byId(page, TestIds.hubCreateWorktree(projectId)),
  hubWorktrees: (page: Page): Locator => page.locator('[data-testid^="hub-worktree-"]'),
  hubProjects: (page: Page): Locator => page.locator('[data-testid^="hub-project-"]'),
  hubHome: (page: Page): Locator => byId(page, TestIds.hubHome),
  hubProjectSummary: (page: Page): Locator => byId(page, TestIds.hubProjectSummary),
  hubWorktreeSummary: (page: Page): Locator => byId(page, TestIds.hubWorktreeSummary),
  hubTabTargets: (page: Page, worktreeId: string): Locator =>
    page.locator(`[data-hub-worktree="${worktreeId}"]`),
  glance: (page: Page): Locator => byId(page, TestIds.glance),
  glanceChangedFiles: (page: Page): Locator => byId(page, TestIds.glanceChangedFiles),

  settingsDialog: (page: Page): Locator => byId(page, TestIds.settingsDialog),
  settingsHeading: (page: Page): Locator => byId(page, TestIds.settingsHeading),
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

  reviewInbox: (page: Page): Locator => byId(page, TestIds.reviewInbox),
  reviewInboxRow: (page: Page, branch: string): Locator =>
    byId(page, TestIds.reviewInboxRow(branch)),
  reviewList: (page: Page): Locator => byId(page, TestIds.reviewList),
  reviewOpen: (page: Page): Locator => byId(page, TestIds.reviewOpen),
  activeReview: (page: Page): Locator => byId(page, TestIds.activeReview),
  activeReviewEmpty: (page: Page): Locator => byId(page, TestIds.activeReviewEmpty),
  activeReviewTab: (page: Page, tab: 'intent' | 'execution' | 'evidence'): Locator =>
    byId(page, TestIds.activeReviewTab(tab)),
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
  reviewArchive: (page: Page): Locator => byId(page, TestIds.reviewArchive),
  boardStartReview: (page: Page): Locator => byId(page, TestIds.boardStartReview),

  commitButton: (page: Page): Locator => byId(page, TestIds.commitButton),
  commitGroup: (page: Page): Locator => byId(page, TestIds.commitGroup),

  terminalNew: (page: Page): Locator => byId(page, TestIds.terminalNew),
  terminalKeyBar: (page: Page): Locator => byId(page, TestIds.terminalKeyBar),
  terminalKey: (page: Page, label: string): Locator => byId(page, TestIds.terminalKey(label)),
  terminalContextMenu: (page: Page): Locator => byId(page, TestIds.terminalContextMenu),
  terminalContextCopy: (page: Page): Locator => byId(page, TestIds.terminalContextCopy),
  terminalContextPaste: (page: Page): Locator => byId(page, TestIds.terminalContextPaste),
  terminalContextPasteImage: (page: Page): Locator => byId(page, TestIds.terminalContextPasteImage),
  terminalContextAttachFile: (page: Page): Locator => byId(page, TestIds.terminalContextAttachFile),
  terminalContextSelectAll: (page: Page): Locator => byId(page, TestIds.terminalContextSelectAll),
  terminalContextClear: (page: Page): Locator => byId(page, TestIds.terminalContextClear),
  actionsAdd: (page: Page): Locator => byId(page, TestIds.actionsAdd),
  actionRun: (page: Page, title: string): Locator => byId(page, TestIds.actionRun(title)),
  actionTitleInput: (page: Page): Locator => byId(page, TestIds.actionTitleInput),
  actionCommandInput: (page: Page): Locator => byId(page, TestIds.actionCommandInput),
  actionSave: (page: Page): Locator => byId(page, TestIds.actionSave),

  viewerTab: (page: Page, title: string): Locator => byId(page, TestIds.viewerTab(title)),
  viewerTabOpenToSide: (page: Page): Locator => byId(page, TestIds.viewerTabOpenToSide),

  treeEntry: (page: Page, name: string): Locator => byId(page, TestIds.treeEntry(name)),
  filePromptName: (page: Page): Locator => byId(page, TestIds.filePromptName),
  fileEditor: (page: Page): Locator => byId(page, TestIds.fileEditor),

  boardCard: (page: Page, title: string): Locator => byId(page, TestIds.boardCard(title)),
  cardTitleInput: (page: Page): Locator => byId(page, TestIds.cardTitleInput),
  cardComposer: (page: Page): Locator => byId(page, TestIds.cardComposer),
  cardComposerSave: (page: Page): Locator => byId(page, TestIds.cardComposerSave),
}
