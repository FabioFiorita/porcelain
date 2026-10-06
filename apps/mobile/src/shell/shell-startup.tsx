import { useEffect } from 'react';
import { useReadEnvironments } from '../features/access';
import { useProjectSelectionCommands } from '../features/projects';
import { RootShell } from './root-shell';

export function ShellStartup() {
  const readEnvironments = useReadEnvironments();
  const { submit } = useProjectSelectionCommands();
  useEffect(() => {
    readEnvironments(undefined);
    submit({ kind: 'read' });
  }, [readEnvironments, submit]);
  return <RootShell />;
}
