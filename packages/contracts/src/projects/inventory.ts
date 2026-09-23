import { z } from 'zod';
import { worktreeIdSchema } from '../shared/worktree-params.ts';

const absentAsNullText = z.codec(
  z.string().nullable(),
  z.union([z.string(), z.undefined()]),
  {
    decode: (value) => value ?? undefined,
    encode: (value) => value ?? null,
  },
);

const reviewStatusSchema = z.enum(['pending', 'reviewed', 'replied']);

const absentAsNullStatus = z.codec(
  reviewStatusSchema.nullable(),
  z.union([reviewStatusSchema, z.undefined()]),
  {
    decode: (value) => value ?? undefined,
    encode: (value) => value ?? null,
  },
);

const absolutePathSchema = z
  .string()
  .min(1)
  .max(4096)
  .startsWith('/')
  .refine((path) => !path.includes('\0'));

export const worktreeSchema = z.object({
  id: worktreeIdSchema,
  path: z.string(),
  main: z.boolean(),
  branch: absentAsNullText,
  available: z.boolean(),
  status: absentAsNullStatus,
});

export const projectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  available: z.boolean(),
  worktrees: z.array(worktreeSchema),
});

const projectParamsSchema = z.strictObject({ projectId: z.uuid() });

export const renameProjectParamsSchema = projectParamsSchema;
export const removeProjectParamsSchema = projectParamsSchema;
export const listFilePreferencesParamsSchema = projectParamsSchema;
export const setFilePreferenceParamsSchema = projectParamsSchema;

export const readInventoryResponseSchema = z.object({
  environmentId: z.uuid(),
  projects: z.array(projectSchema),
});

export const registerProjectRequestSchema = z.strictObject({
  path: absolutePathSchema,
});
export const registerProjectResponseSchema = projectSchema;

export const removeProjectResponseSchema = z.object({ deleted: z.boolean() });

const projectLocationSchema = z.object({ name: z.string(), path: z.string() });

export const discoverProjectsResponseSchema = z.object({
  repositories: z.array(projectLocationSchema),
  limited: z.boolean(),
});

export const browseProjectFoldersQuerySchema = z.strictObject({
  path: absolutePathSchema.optional(),
});
export const browseProjectFoldersResponseSchema = z.object({
  path: z.string(),
  parent: absentAsNullText,
  directories: z.array(projectLocationSchema),
  repository: z.boolean(),
  truncated: z.boolean(),
});

export const renameProjectRequestSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine((value) => !/[\p{Cc}\p{Cf}]/u.test(value), {
      message: 'The name must not contain control characters',
    }),
});
export const renameProjectResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

export type Worktree = z.output<typeof worktreeSchema>;
export type Project = z.output<typeof projectSchema>;
export type RenameProjectParams = z.output<typeof renameProjectParamsSchema>;
export type RemoveProjectParams = z.output<typeof removeProjectParamsSchema>;
export type ListFilePreferencesParams = z.output<
  typeof listFilePreferencesParamsSchema
>;
export type SetFilePreferenceParams = z.output<
  typeof setFilePreferenceParamsSchema
>;
export type ReadInventoryResponse = z.output<
  typeof readInventoryResponseSchema
>;
export type RegisterProjectRequest = z.output<
  typeof registerProjectRequestSchema
>;
export type RegisterProjectResponse = z.output<
  typeof registerProjectResponseSchema
>;
export type RemoveProjectResponse = z.output<
  typeof removeProjectResponseSchema
>;
export type DiscoverProjectsResponse = z.output<
  typeof discoverProjectsResponseSchema
>;
export type BrowseProjectFoldersQuery = z.output<
  typeof browseProjectFoldersQuerySchema
>;
export type BrowseProjectFoldersResponse = z.output<
  typeof browseProjectFoldersResponseSchema
>;
export type RenameProjectRequest = z.output<typeof renameProjectRequestSchema>;
export type RenameProjectResponse = z.output<
  typeof renameProjectResponseSchema
>;
