import { Stack } from 'expo-router';
import type { WorktreeSwitcher } from '../features/projects';
import { topBarItems } from '../components/ui/top-bar-items';
import { usePublishedTopBar } from '../shared/application/top-bar';

export function TopBar({ switcher }: { switcher?: WorktreeSwitcher }) {
  const published = usePublishedTopBar();
  const leading = switcher?.items ?? [];
  const items = switcher?.holdsPageActions ? [] : topBarItems(published);
  if (leading.length === 0 && items.length === 0) return null;
  return (
    <Stack.Toolbar placement="right">
      {leading}
      {leading.length > 0 && items.length > 0 ? (
        <Stack.Toolbar.Spacer key="actions-gap" width={8} />
      ) : null}
      {items}
    </Stack.Toolbar>
  );
}
