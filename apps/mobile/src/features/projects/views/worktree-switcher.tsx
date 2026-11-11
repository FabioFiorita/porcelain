import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { useCSSVariable } from 'uniwind';
import { headerIcon } from '../../../shared/icons/header-icon';
import type { HeaderIconName } from '../../../shared/icons/icon';
import { shortcutHint } from '../../../components/ui/shortcut-hint';
import { usePublishedTopBar } from '../../../shared/application/top-bar';
import {
  worktreeSections,
  type WorktreeSection,
} from '../rules/worktree-section';

const icons = {
  walkthrough: 'walkthrough',
  changes: 'changes',
  files: 'browse',
  history: 'history',
} as const satisfies Record<WorktreeSection, HeaderIconName>;

export function useWorktreeBarItems() {
  return worktreeSections.length + usePublishedTopBar().length;
}

function color(value: string | number | undefined) {
  return typeof value === 'string' ? value : undefined;
}

export function useWorktreeSwitcher(
  section: WorktreeSection | undefined,
  choose: (section: WorktreeSection) => void,
): ReactNode[] {
  const current = color(useCSSVariable('--brand'));
  const other = color(useCSSVariable('--muted-foreground'));
  return worktreeSections.map((entry) => {
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
  });
}
