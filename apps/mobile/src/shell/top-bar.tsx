import { Stack } from 'expo-router';
import { useTopBarItems } from '../components/ui/top-bar-items';
import { usePublishedTopBar } from '../shared/application/top-bar';

export function TopBar() {
  const items = useTopBarItems(usePublishedTopBar());
  if (items.length === 0) return null;
  return <Stack.Toolbar placement="right">{items}</Stack.Toolbar>;
}
