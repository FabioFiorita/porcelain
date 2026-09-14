import { describe, expect, it } from 'vitest';
import { SHORTCUT_GROUPS, SHORTCUTS } from './shortcuts';

describe('workspace shortcuts', () => {
  it('advertises only shortcuts with registered handlers', () => {
    expect(SHORTCUTS).toEqual({
      toggleNavigator: 'Mod+B',
      toggleSidebar: 'Alt+Shift+R',
      cycleAppearance: 'Alt+Shift+D',
      openSettings: 'Alt+Shift+S',
      openShortcuts: 'Mod+/',
      surfaceReview: 'Alt+1',
      surfaceFiles: 'Alt+2',
      surfaceHistory: 'Alt+3',
      nextTab: 'Alt+ArrowRight',
      previousTab: 'Alt+ArrowLeft',
      closeTab: 'Alt+W',
      openToSide: 'Alt+\\',
    });

    expect(SHORTCUT_GROUPS).toEqual([
      {
        title: 'Workspace',
        items: [
          { keys: 'Mod+B', label: 'Show or hide projects' },
          {
            keys: 'Alt+Shift+R',
            label: 'Show or hide the right sidebar',
          },
          { keys: 'Alt+1', label: 'Go to Changes / Review' },
          { keys: 'Alt+2', label: 'Go to Files' },
          { keys: 'Alt+3', label: 'Go to History' },
          { keys: 'Alt+Shift+S', label: 'Settings' },
          { keys: 'Alt+Shift+D', label: 'Cycle appearance' },
          { keys: 'Mod+/', label: 'Keyboard shortcuts' },
        ],
      },
      {
        title: 'Tabs',
        items: [
          { keys: 'Alt+ArrowRight', label: 'Next tab' },
          { keys: 'Alt+ArrowLeft', label: 'Previous tab' },
          { keys: 'Alt+W', label: 'Close tab' },
          { keys: 'Alt+\\', label: 'Open the tab to the side' },
        ],
      },
    ]);
  });
});
