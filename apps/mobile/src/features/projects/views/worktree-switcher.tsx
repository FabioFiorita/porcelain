import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { useCSSVariable } from 'uniwind';
import { headerIcon } from '../../../shared/icons/header-icon';
import type { HeaderIconName } from '../../../shared/icons/icon';
import { shortcutHint } from '../../../components/ui/shortcut-hint';
import { topBarMenuEntries } from '../../../components/ui/top-bar-items';
import { usePublishedTopBar } from '../../../shared/application/top-bar';
import type { ListDetailMode } from '../../../shared/rules/list-detail';
import {
  worktreeSections,
  type WorktreeSection,
} from '../rules/worktree-section';
import { phoneTopBar } from '../rules/worktree-switcher';

export type WorktreeSwitcher = {
  items: readonly ReactNode[];
  holdsPageActions: boolean;
};

const icons = {
  walkthrough: 'walkthrough',
  changes: 'changes',
  files: 'browse',
  history: 'history',
} as const satisfies Record<WorktreeSection, HeaderIconName>;

const label = (section: WorktreeSection) =>
  worktreeSections.find((entry) => entry.id === section)?.label ?? section;

export function useWorktreeBarItems() {
  return worktreeSections.length + usePublishedTopBar().length;
}

function color(value: string | number | undefined) {
  return typeof value === 'string' ? value : undefined;
}

export function useWorktreeSwitcher(
  section: WorktreeSection | undefined,
  choose: (section: WorktreeSection) => void,
  mode: ListDetailMode,
): WorktreeSwitcher {
  const current = color(useCSSVariable('--brand'));
  const other = color(useCSSVariable('--muted-foreground'));
  const pageActions = usePublishedTopBar();
  if (mode === 'stack')
    return {
      holdsPageActions: true,
      items: phoneTopBar(section, pageActions).map((button) =>
        button.kind === 'current' ? (
          <Stack.Toolbar.Button
            key="destination:current"
            icon={headerIcon(icons[button.section])}
            accessibilityLabel={`${label(button.section)}, current destination`}
            {...(current ? { tintColor: current } : {})}
            selected
          />
        ) : (
          <Stack.Toolbar.Menu
            key="destination:more"
            icon={headerIcon('more')}
            accessibilityLabel="More"
          >
            {button.destinations.map((id) => {
              const hint = shortcutHint(id);
              return (
                <Stack.Toolbar.MenuAction
                  key={`destination:${id}`}
                  icon={headerIcon(icons[id])}
                  {...(hint ? { discoverabilityLabel: hint } : {})}
                  onPress={() => choose(id)}
                >
                  {label(id)}
                </Stack.Toolbar.MenuAction>
              );
            })}
            {button.actions.length > 0 ? (
              <Stack.Toolbar.Menu key="page-actions" inline>
                {topBarMenuEntries(button.actions)}
              </Stack.Toolbar.Menu>
            ) : null}
          </Stack.Toolbar.Menu>
        ),
      ),
    };
  return {
    holdsPageActions: false,
    items: worktreeSections.map((entry) => {
      const hint = shortcutHint(entry.id);
      const tint = entry.id === section ? current : other;
      return (
        <Stack.Toolbar.Button
          key={`destination:${entry.id}`}
          icon={headerIcon(icons[entry.id])}
          accessibilityLabel={entry.label}
          {...(hint ? { accessibilityHint: hint } : {})}
          {...(tint ? { tintColor: tint } : {})}
          selected={entry.id === section}
          onPress={() => choose(entry.id)}
        />
      );
    }),
  };
}
