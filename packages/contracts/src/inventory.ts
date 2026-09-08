import { z } from 'zod';

const worktreeSchema = z.object({
  id: z.uuid(),
  path: z.string(),
  main: z.boolean(),
  branch: z.string().nullable(),
  available: z.boolean(),
});

export const projectResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  available: z.boolean(),
  worktrees: z.array(worktreeSchema),
});

export const inventoryResponseSchema = z.object({
  environmentId: z.uuid(),
  projects: z.array(projectResponseSchema),
});

export const registerProjectRequestSchema = z.strictObject({
  path: z
    .string()
    .min(1)
    .max(4096)
    .refine((path) => !path.includes('\0')),
});

export type ProjectResponse = z.infer<typeof projectResponseSchema>;
export type InventoryResponse = z.infer<typeof inventoryResponseSchema>;

export const projectParamsSchema = z.strictObject({ projectId: z.uuid() });
export const projectDeletionSchema = z.object({ deleted: z.boolean() });
