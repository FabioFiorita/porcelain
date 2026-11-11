import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { headerIcon } from '../../../shared/icons/header-icon';
import type { HeaderIconName } from '../../../shared/icons/icon';
import { shortcutHint } from '../../../components/ui/shortcut-hint';
import { headerBarSpace } from '../../../components/ui/header-title-frame';
import { usePublishedTopBar } from '../../../shared/application/top-bar';
import {
  worktreeSections,
  type WorktreeSection,
} from '../rules/worktree-section';
import {
  worktreeSwitcherForm,
  worktreeSwitcherItems,
  type WorktreeBarPlace,
} from '../rules/worktree-switcher';

const icons = {
  walkthrough: 'walkthrough',
  changes: 'changes',
  files: 'browse',
  history: 'history',
} as const satisfies Record<WorktreeSection, HeaderIconName>;

function useWorktreeSwitcherForm(
  title: string | undefined,
  place: WorktreeBarPlace,
) {
  const { width, fontScale } = useWindowDimensions();
  const otherItems = usePublishedTopBar().length;
  return {
    form: worktreeSwitcherForm({
      barWidth: width,
      bar: headerBarSpace,
      place,
      fontScale,
      title,
      otherItems,
    }),
    otherItems,
  };
}

export function useWorktreeBarItems(
  title: string | undefined,
  place: WorktreeBarPlace,
) {
  const { form, otherItems } = useWorktreeSwitcherForm(title, place);
  return worktreeSwitcherItems(form) + otherItems;
}

function color(value: string | number | undefined) {
  return typeof value === 'string' ? value : undefined;
}

export function useWorktreeSwitcher(
  section: WorktreeSection | undefined,
  choose: (section: WorktreeSection) => void,
  { title, place }: { title: string | undefined; place: WorktreeBarPlace },
): ReactNode[] {
  const current = color(useCSSVariable('--brand'));
  const other = color(useCSSVariable('--muted-foreground'));
  const { form } = useWorktreeSwitcherForm(title, place);
  if (form === 'menu') {
    const shown = worktreeSections.find((entry) => entry.id === section);
    const tint = shown ? current : other;
    return [
      <Stack.Toolbar.Menu
        key="destinations"
        icon={headerIcon(shown ? icons[shown.id] : 'more')}
        accessibilityLabel={
          shown
            ? `${shown.label}, choose a destination`
            : 'Choose a destination'
        }
        title="Go to"
        {...(tint ? { tintColor: tint } : {})}
      >
        {worktreeSections.map((entry) => (
          <Stack.Toolbar.MenuAction
            key={`destination:${entry.id}`}
            icon={headerIcon(icons[entry.id])}
            isOn={entry.id === section}
            onPress={() => choose(entry.id)}
          >
            {entry.label}
          </Stack.Toolbar.MenuAction>
        ))}
      </Stack.Toolbar.Menu>,
    ];
  }
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
