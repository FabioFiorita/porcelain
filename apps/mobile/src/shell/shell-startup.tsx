import { useEffect } from 'react';
import {
  useReadEnvironments,
  environmentSelectionAccess,
} from '../features/access';
import { useProjectSelectionCommands } from '../features/projects';
import { RootShell } from './root-shell';

export function ShellStartup() {
  const readEnvironments = useReadEnvironments();
  const { submit } = useProjectSelectionCommands(environmentSelectionAccess);
  useEffect(() => {
    readEnvironments();
    submit({ kind: 'read' });
  }, [readEnvironments, submit]);
  return <RootShell />;
}
