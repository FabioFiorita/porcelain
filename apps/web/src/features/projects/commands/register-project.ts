import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectCommands } from '@porcelain/client/projects';
import { asMutation, operationMutation } from '@/shared/query/mutation';
import type { Connection } from '@/shared/workspace/connection';

export function useRegisterProject(connection: Connection) {
  const commands = projectCommands(connection, useQueryClient());
  return asMutation(
    useMutation(operationMutation(commands.register, connection)),
  );
}
