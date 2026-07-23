import type { Locator, Page } from '@playwright/test'
import { TestIds } from './test-ids'

/** Playwright root for a stable `data-testid`. Prefer this over getByText/getByRole in e2e. */
export function byId(page: Page | Locator, id: string): Locator {
  return page.getByTestId(id)
}

export const loc = {
  rail: (page: Page): Locator => byId(page, TestIds.rail),
  railTab: (page: Page, tab: string): Locator => byId(page, TestIds.railTab(tab)),
  railSettings: (page: Page): Locator => byId(page, TestIds.railSettings),
  sidebarPanel: (page: Page): Locator => byId(page, TestIds.sidebarPanel),
  rightSidebar: (page: Page): Locator => byId(page, TestIds.rightSidebar),
  toggleRightSidebar: (page: Page): Locator => byId(page, TestIds.toggleRightSidebar),

  welcome: (page: Page): Locator => byId(page, TestIds.welcome),
  welcomeOpenRepo: (page: Page): Locator => byId(page, TestIds.welcomeOpenRepo),
  glance: (page: Page): Locator => byId(page, TestIds.glance),
  glanceChangedFiles: (page: Page): Locator => byId(page, TestIds.glanceChangedFiles),

  settingsDialog: (page: Page): Locator => byId(page, TestIds.settingsDialog),
  settingsHeading: (page: Page): Locator => byId(page, TestIds.settingsHeading),
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

  worktreeSwitcher: (page: Page): Locator => byId(page, TestIds.worktreeSwitcher),
  worktreeMenuItem: (page: Page, branch: string): Locator =>
    byId(page, TestIds.worktreeMenuItem(branch)),
  branchSwitcher: (page: Page): Locator => byId(page, TestIds.branchSwitcher),

  reviewInbox: (page: Page): Locator => byId(page, TestIds.reviewInbox),
  reviewInboxRow: (page: Page, branch: string): Locator =>
    byId(page, TestIds.reviewInboxRow(branch)),
  featureOpenReview: (page: Page): Locator => byId(page, TestIds.featureOpenReview),
  featureCanvas: (page: Page): Locator => byId(page, TestIds.featureCanvas),
  featureCanvasTab: (page: Page, tab: 'intent' | 'execution' | 'evidence'): Locator =>
    byId(page, TestIds.featureCanvasTab(tab)),
  evidencePanel: (page: Page): Locator => byId(page, TestIds.evidencePanel),
  evidenceClear: (page: Page): Locator => byId(page, TestIds.evidenceClear),
  evidenceIframe: (page: Page): Locator => byId(page, TestIds.evidenceIframe),

  commitButton: (page: Page): Locator => byId(page, TestIds.commitButton),
  commitGroup: (page: Page): Locator => byId(page, TestIds.commitGroup),

  agentNewThread: (page: Page): Locator => byId(page, TestIds.agentNewThread),
  agentProviderMenu: (page: Page): Locator => byId(page, TestIds.agentProviderMenu),
  agentWorktreeMenuItem: (page: Page): Locator => byId(page, TestIds.agentWorktreeMenuItem),
  agentWorktreeBranch: (page: Page): Locator => byId(page, TestIds.agentWorktreeBranch),
  agentWorktreeCreate: (page: Page): Locator => byId(page, TestIds.agentWorktreeCreate),
  agentThreadByTitle: (page: Page, title: string): Locator =>
    page.locator(`[data-testid^="agent-thread-row-"][data-title="${title}"]`),
  agentThreadFilter: (page: Page, filter: 'active' | 'recent' | 'archived'): Locator =>
    byId(page, TestIds.agentThreadFilter(filter)),
  agentComposer: (page: Page): Locator => byId(page, TestIds.agentComposer),
  agentSend: (page: Page): Locator => byId(page, TestIds.agentSend),
  agentModeChip: (page: Page): Locator => byId(page, TestIds.agentModeChip),
  agentModeOption: (page: Page, mode: string): Locator => byId(page, TestIds.agentModeOption(mode)),
  agentTimeline: (page: Page): Locator => byId(page, TestIds.agentTimeline),
  agentPlan: (page: Page): Locator => byId(page, TestIds.agentPlan),
  agentPlanProgress: (page: Page): Locator => byId(page, TestIds.agentPlanProgress),
  agentTool: (page: Page, title: string): Locator => byId(page, TestIds.agentTool(title)),
  agentApprovalAccept: (page: Page): Locator => byId(page, TestIds.agentApprovalAccept),
  agentApprovalStatus: (page: Page): Locator => byId(page, TestIds.agentApprovalStatus),
  agentSessionStatus: (page: Page): Locator => byId(page, TestIds.agentSessionStatus),
  agentSessionCompanionStatus: (page: Page): Locator =>
    byId(page, TestIds.agentSessionCompanionStatus),
  agentUsageLastTurn: (page: Page): Locator => byId(page, TestIds.agentUsageLastTurn),
  agentUserBubble: (page: Page): Locator => byId(page, TestIds.agentUserBubble),
  agentAssistantMessage: (page: Page): Locator => byId(page, TestIds.agentAssistantMessage),

  terminalNew: (page: Page): Locator => byId(page, TestIds.terminalNew),
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
