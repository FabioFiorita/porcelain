/**
 * Mirror of packages/contracts/src/file-preferences.ts, project-scoped.
 *
 * PROPOSED: remove `pinned`. File pinning is cut from v1, so only `hidden`
 * remains, on the preference and in the request's `flag`.
 */

export type FilePreference = {
  /** Relative path. A folder ends with `/` and hides everything under it. */
  path: string;
  hidden: boolean;
};

export type FilePreferencesResponse = { preferences: FilePreference[] };

/** Today `flag` is `'pinned' | 'hidden'`. */
export type SetFilePreferenceRequest = {
  path: string;
  flag: 'hidden';
  value: boolean;
};
