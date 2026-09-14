/** One source for registered hotkeys and the list shown in the dialog. */
export const SHORTCUTS = {
  toggleNavigator: 'Mod+B',
  toggleSidebar: 'Alt+Shift+R',
  cycleAppearance: 'Alt+Shift+D',
  openSettings: 'Alt+Shift+S',
  openShortcuts: 'Mod+/',
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
];
