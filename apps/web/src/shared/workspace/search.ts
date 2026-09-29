import { z } from 'zod';
import { WORKSPACE_SEARCH_VALUE_MAX_LENGTH } from '@/config/limits';

const surfaceSchema = z.enum(['changes', 'files', 'history']);
const changeScopeSchema = z.enum(['uncommitted', 'branch']);
const searchValueSchema = z
  .string()
  .max(WORKSPACE_SEARCH_VALUE_MAX_LENGTH)
  .optional()
  .catch(undefined);

export const workspaceSearchSchema = z.object({
  surface: surfaceSchema.optional().catch(undefined),
  entry: searchValueSchema,
  side: searchValueSchema,
  scope: changeScopeSchema.optional().catch(undefined),
  base: searchValueSchema,
});

export type Surface = z.output<typeof surfaceSchema>;
export type ChangeScope = z.output<typeof changeScopeSchema>;
export type WorkspaceSearch = z.output<typeof workspaceSearchSchema>;
export type SetWorkspaceSearch = (
  update: Partial<WorkspaceSearch>,
  options?: { replace: boolean },
) => void;

export function isSurface(value: unknown): value is Surface {
  return surfaceSchema.safeParse(value).success;
}

export function isChangeScope(value: unknown): value is ChangeScope {
  return changeScopeSchema.safeParse(value).success;
}
