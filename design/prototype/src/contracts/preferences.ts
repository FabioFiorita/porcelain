/** PROPOSED in full: no settings contract exists. The prototype keeps these in localStorage. */

export type Preferences = {
  appearance: 'system' | 'light' | 'dark';
  diffStyle: 'unified' | 'split';
  lineOverflow: 'scroll' | 'wrap';
  markdownDefault: 'reader' | 'source';
  htmlDefault: 'preview' | 'source';
  pullStrategy: 'ff-only' | 'merge' | 'rebase';
  /** The model that drafts commit messages and groups; an id from `COMMIT_MODELS`. */
  commitModel: string;
};
