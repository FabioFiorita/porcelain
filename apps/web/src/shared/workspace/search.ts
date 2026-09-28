import { z } from 'zod';
import { WORKSPACE_SEARCH_VALUE_MAX_LENGTH } from '@/config/limits';

const surfaceSchema = z.enum(['changes', 'files', 'history']);
const searchValueSchema = z
  .string()
  .max(WORKSPACE_SEARCH_VALUE_MAX_LENGTH)
  .optional()
  .catch(undefined);

export const workspaceSearchSchema = z.object({
  surface: surfaceSchema.optional().catch(undefined),
  entry: searchValueSchema,
  side: searchValueSchema,
});

export type Surface = z.output<typeof surfaceSchema>;
export type WorkspaceSearch = z.output<typeof workspaceSearchSchema>;
export type SetWorkspaceSearch = (
  update: Partial<WorkspaceSearch>,
  options?: { replace: boolean },
) => void;

export function isSurface(value: unknown): value is Surface {
  return surfaceSchema.safeParse(value).success;
}
