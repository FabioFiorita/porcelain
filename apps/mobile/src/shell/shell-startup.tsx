import { useEffect } from 'react';
import {
  useReadEnvironments,
  environmentSelectionAccess,
} from '../features/access';
import { useProjectSelectionCommands } from '../features/projects';
import { RootShell } from './root-shell';

export function ShellStartup() {
  const readEnvironments = useReadEnvironments();
  const { onSubmit } = useProjectSelectionCommands(environmentSelectionAccess);
  useEffect(() => {
    readEnvironments();
    onSubmit({ kind: 'read' });
  }, [readEnvironments, onSubmit]);
  return <RootShell />;
}
