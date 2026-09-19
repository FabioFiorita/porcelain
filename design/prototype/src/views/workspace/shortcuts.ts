/** One list for the hotkeys the prototype registers and the dialog that explains them. */
export const SHORTCUTS = {
  toggleNavigator: 'Mod+B',
  toggleSidebar: 'Alt+Shift+R',
  cycleAppearance: 'Alt+Shift+D',
  openSettings: 'Alt+Shift+S',
  // The usual place for a shortcut list (Slack, Linear, GitHub's command bar).
  openShortcuts: 'Mod+/',
  // As in VS Code and Zed.
  quickOpen: 'Mod+P',
  surfaceReview: 'Alt+1',
  surfaceFiles: 'Alt+2',
  surfaceHistory: 'Alt+3',
  nextTab: 'Alt+ArrowRight',
  previousTab: 'Alt+ArrowLeft',
  closeTab: 'Alt+W',
  openToSide: 'Alt+\\',
  nextFile: 'J',
  previousFile: 'K',
  toggleReviewed: 'R',
  commentOnFile: 'C',
  submitComment: 'Mod+Enter',
  saveFile: 'Mod+S',
  cancel: 'Escape',
  commit: 'Mod+Enter',
} as const;

export const SHORTCUT_GROUPS: {
  title: string;
  items: { keys: string; label: string }[];
}[] = [
  {
    title: 'Workspace',
    items: [
      { keys: SHORTCUTS.quickOpen, label: 'Go to a file by name' },
      { keys: SHORTCUTS.toggleNavigator, label: 'Show or hide projects' },
      {
        keys: SHORTCUTS.toggleSidebar,
        label: 'Show or hide the review sidebar',
      },
      { keys: SHORTCUTS.surfaceReview, label: 'Go to Changes / Review' },
      { keys: SHORTCUTS.surfaceFiles, label: 'Go to Files' },
      { keys: SHORTCUTS.surfaceHistory, label: 'Go to History' },
      { keys: SHORTCUTS.openSettings, label: 'Settings' },
      { keys: SHORTCUTS.cycleAppearance, label: 'Cycle appearance' },
      { keys: SHORTCUTS.openShortcuts, label: 'Keyboard shortcuts' },
    ],
  },
  {
    title: 'Tabs',
    items: [
      { keys: SHORTCUTS.nextTab, label: 'Next tab' },
      { keys: SHORTCUTS.previousTab, label: 'Previous tab' },
      { keys: SHORTCUTS.closeTab, label: 'Close tab' },
      { keys: SHORTCUTS.openToSide, label: 'Open the tab to the side' },
    ],
  },
  {
    title: 'Reviewing',
    items: [
      { keys: SHORTCUTS.nextFile, label: 'Next file' },
      { keys: SHORTCUTS.previousFile, label: 'Previous file' },
      {
        keys: SHORTCUTS.toggleReviewed,
        label: 'Mark the current file reviewed',
      },
      { keys: SHORTCUTS.commentOnFile, label: 'Comment on the current file' },
      { keys: SHORTCUTS.submitComment, label: 'Post the comment or reply' },
      { keys: SHORTCUTS.cancel, label: 'Cancel the comment' },
      {
        keys: SHORTCUTS.saveFile,
        label: 'Save now (edits also save as you pause)',
      },
    ],
  },
  {
    title: 'Git',
    items: [{ keys: SHORTCUTS.commit, label: 'Commit, in the commit dialog' }],
  },
];
