import { Schema } from 'effect';

const setManagementPermissionSchema = Schema.Struct({
  id: Schema.String,
  allowed: Schema.Boolean,
});
export type SetManagementPermissionInput =
  typeof setManagementPermissionSchema.Type;
export type SetManagementPermissionResult =
  typeof setManagementPermissionSchema.Type;
