import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Cause } from 'effect';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { projectPath, type Project } from '@porcelain/client/projects/rules';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { ProjectActionMenu } from './project-action-menu';
import { useProjectActions } from '../commands/project-actions';

export function ProjectActions({
  connection,
  project,
  environmentName,
  onCopy,
}: {
  connection: RuntimeConnection;
  project: Project;
  environmentName: string;
  onCopy: (path: string) => void;
}) {
  const router = useRouter();
  const commands = useProjectActions(connection, project.id);
  return (
    <ProjectActionMenu
      label={`Project actions: ${project.name} · ${environmentName}`}
      actions={[
        {
          id: 'copy',
          label: 'Copy path',
          onPress: () => onCopy(projectPath(project)),
        },
        {
          id: 'rename',
          label: 'Rename project',
          onPress: () =>
            router.push({
              pathname: '/rename-project',
              params: {
                environmentId: connection.environmentId,
                projectId: project.id,
              },
            }),
        },
        {
          id: 'remove',
          label: 'Remove from Porcelain',
          destructive: true,
          onPress: () =>
            Alert.alert(
              `Remove ${project.name} from Porcelain?`,
              'The repository and its worktrees stay on this computer. You can add the project again later.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () =>
                    commands.remove(
                      () => undefined,
                      (cause) =>
                        Alert.alert(
                          'Project not removed',
                          connectionErrorMessage(Cause.squash(cause)),
                        ),
                    ),
                },
              ],
            ),
        },
      ]}
    />
  );
}
