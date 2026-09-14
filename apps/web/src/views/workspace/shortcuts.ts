/** One source for registered hotkeys and the list shown in the dialog. */
export const SHORTCUTS = {
  saveFile: 'Mod+S',
  toggleNavigator: 'Mod+B',
  toggleSidebar: 'Alt+Shift+R',
  cycleAppearance: 'Alt+Shift+D',
  openSettings: 'Alt+Shift+S',
  openShortcuts: 'Mod+/',
  surfaceReview: 'Alt+1',
  surfaceFiles: 'Alt+2',
  surfaceHistory: 'Alt+3',
  nextFile: 'J',
  previousFile: 'K',
  toggleReviewed: 'R',
  commentOnFile: 'C',
  nextTab: 'Alt+ArrowRight',
  previousTab: 'Alt+ArrowLeft',
  closeTab: 'Alt+W',
  openToSide: 'Alt+\\',
} as const;

export const SHORTCUT_GROUPS: {
  title: string;
  items: { keys: string; label: string }[];
}[] = [
  {
    title: 'Workspace',
    items: [
      { keys: SHORTCUTS.toggleNavigator, label: 'Show or hide projects' },
      {
        keys: SHORTCUTS.toggleSidebar,
        label: 'Show or hide the right sidebar',
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
    title: 'Code review',
    items: [
      { keys: SHORTCUTS.nextFile, label: 'Next file' },
      { keys: SHORTCUTS.previousFile, label: 'Previous file' },
      { keys: SHORTCUTS.toggleReviewed, label: 'Toggle reviewed' },
      { keys: SHORTCUTS.commentOnFile, label: 'Comment on file' },
      { keys: SHORTCUTS.saveFile, label: 'Save file edits' },
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
];
