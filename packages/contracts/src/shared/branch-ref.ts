import { Schema } from 'effect';
import { GIT_REF_LENGTH } from './limits.ts';

export const branchRefSchema = Schema.String.check(Schema.isMinLength(1))
  .check(Schema.isMaxLength(GIT_REF_LENGTH))
  .check(Schema.isPattern(/^refs\/(?:heads|remotes)\/\S+$/u));
