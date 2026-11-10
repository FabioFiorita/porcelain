export const SHORTCUTS = {
  saveFile: 'Mod+S',
  toggleNavigator: 'Mod+B',
  toggleSidebar: 'Alt+Shift+R',
  cycleAppearance: 'Alt+Shift+D',
  openSettings: 'Alt+Shift+S',
  closeSettings: 'Escape',
  openShortcuts: 'Mod+/',
  surfaceFiles: 'Alt+1',
  surfaceChanges: 'Alt+2',
  surfaceHistory: 'Alt+3',
  nextFile: 'J',
  previousFile: 'K',
  toggleReviewed: 'R',
  findInFile: 'Mod+F',
  duplicateFile: 'Mod+D',
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
        label: 'Show or hide the side panel',
      },
      { keys: SHORTCUTS.surfaceFiles, label: 'Go to Files' },
      { keys: SHORTCUTS.surfaceChanges, label: 'Go to Changes' },
      { keys: SHORTCUTS.surfaceHistory, label: 'Go to History' },
      { keys: SHORTCUTS.openSettings, label: 'Settings' },
      { keys: SHORTCUTS.closeSettings, label: 'Close Settings' },
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
      { keys: SHORTCUTS.findInFile, label: 'Find in file' },
      { keys: SHORTCUTS.saveFile, label: 'Save file edits' },
      {
        keys: SHORTCUTS.duplicateFile,
        label: 'Duplicate the open file (Files panel open)',
      },
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
