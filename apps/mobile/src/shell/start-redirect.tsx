import { Redirect } from 'expo-router';
import { Spinner } from '../components/ui/spinner';
import { useWorkspace } from '../features/projects';
import { startPath } from '../shared/rules/start-path';

export function StartRedirect() {
  const path = startPath(useWorkspace().state.kind);
  return path ? <Redirect href={path} /> : <Spinner />;
}
